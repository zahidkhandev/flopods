// File: apps/backend/src/v1/execution/execution.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import { ProviderFactory } from './providers/provider.factory';
import { V1ContextResolutionService } from './context-resolution.service';
import { LLMProvider, PodExecutionStatus } from '@flopods/schema';
import { ExecutionHistoryItemDto, ExecutionDetailDto } from './dto/execution-response.dto';
import { LLMPromptPodContent, PodContextMapping } from '../pods/types/pod-content.types';
import { LLMStreamChunk } from './types/llm-provider.types';
import { nanoid } from 'nanoid';
import { V1FlowGateway } from '../flow/flow.gateway';

// Unified cost/profit/credits utilities
import {
  calculateTokenCosts,
  applyMarkup,
  settleCreditsCharge,
  formatCostBreakdown,
  formatProfitBreakdown,
} from '../../common/utils/profit-and-credits';

type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class V1ExecutionService {
  private readonly logger = new Logger(V1ExecutionService.name);

  private readonly DEFAULT_SYSTEM_PROMPTS = {
    general: 'You are a helpful AI assistant. Provide clear, accurate, and concise responses.',
    analyst: 'You are a data analyst. Analyze information objectively and provide insights.',
    coder: 'You are a coding assistant. Write clean, efficient, and well-documented code.',
    creative: 'You are a creative writing assistant. Be imaginative and engaging.',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamoDb: DynamoDbService,
    private readonly providerFactory: ProviderFactory,
    private readonly contextResolution: V1ContextResolutionService,
    private readonly flowGateway: V1FlowGateway,
  ) {}

  /**
   * INSTANT STREAMING with CONVERSATION HISTORY + PROFIT/CREDITS TRACKING
   */
  async *executePod(params: {
    podId: string;
    workspaceId: string;
    userId: string;
    messages: LLMMessage[];
    provider?: LLMProvider;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    thinkingBudget?: number;
    responseFormat?: 'text' | 'json_object' | 'json';
    contextMappings?: PodContextMapping[];
  }): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const { podId, workspaceId, userId, messages } = params;
    const executionId = `exec_${nanoid(16)}`;
    const startTime = Date.now();
    let _podFlowId: string | null = null;

    try {
      // Pod validations and config fetch
      const pod = await this.prisma.pod.findFirst({
        where: { id: podId, flow: { workspaceId } },
        select: {
          flowId: true,
          id: true,
          type: true,
          dynamoPartitionKey: true,
          dynamoSortKey: true,
        },
      });
      if (!pod) {
        yield { type: 'error', error: `Pod ${podId} not found` };
        return;
      }
      _podFlowId = pod.flowId;
      if (pod.type !== 'LLM_PROMPT') {
        yield { type: 'error', error: 'Only LLM_PROMPT pods can be executed' };
        return;
      }
      const podConfig = await this.getPodConfig(pod.dynamoPartitionKey, pod.dynamoSortKey);
      if (!podConfig) {
        yield { type: 'error', error: 'Pod configuration not found' };
        return;
      }
      const llmConfig = podConfig.config;

      // Parameter resolution
      const finalProvider = params.provider ?? llmConfig.provider;
      const finalModel = params.model ?? llmConfig.model;
      const finalTemperature = params.temperature ?? llmConfig.temperature;
      const finalMaxTokens = params.maxTokens ?? llmConfig.maxTokens;
      const finalTopP = params.topP ?? llmConfig.topP;
      const finalPresencePenalty = params.presencePenalty ?? llmConfig.presencePenalty;
      const finalFrequencyPenalty = params.frequencyPenalty ?? llmConfig.frequencyPenalty;
      const finalThinkingBudget = params.thinkingBudget ?? llmConfig.thinkingBudget;
      const finalResponseFormat = params.responseFormat ?? llmConfig.responseFormat;

      const userMessage = messages.find((m) => m.role === 'user');
      const userInput = userMessage?.content || '';

      // Create execution record
      await this.prisma.podExecution.create({
        data: {
          id: executionId,
          podId,
          flowId: pod.flowId,
          workspaceId,
          status: PodExecutionStatus.RUNNING,
          provider: finalProvider,
          modelId: finalModel,
          startedAt: new Date(),
          requestMetadata: {
            userId,
            userInput,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: finalTemperature,
            maxTokens: finalMaxTokens,
            provider: finalProvider,
            model: finalModel,
          },
        },
      });

      this.flowGateway.broadcastExecutionStart(pod.flowId, executionId, podId);

      // Context & system prompt assembly
      const conversationHistory = await this.getPodConversationHistory(podId, 20);
      const contextChain = await this.contextResolution.resolveFullContext(podId, pod.flowId);

      let systemPrompt = params.systemPrompt ?? this.DEFAULT_SYSTEM_PROMPTS.general;
      systemPrompt = this.contextResolution.interpolateVariables(
        systemPrompt,
        contextChain.variables,
      );

      if (Object.keys(contextChain.variables).length > 0) {
        const contextSection = '\n\n## Context from Connected Pods:\n\n';
        const contextDetails = Object.entries(contextChain.variables)
          .map(([pid, content]) => `**Pod ${pid} History:**\n${content}`)
          .join('\n\n');
        systemPrompt += contextSection + contextDetails;
      }

      // Inject user profile & workspace info
      const userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const workspaceUser = await this.prisma.workspaceUser.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { role: true },
      });
      const userRole = workspaceUser?.role ?? 'Unknown';
      if (userProfile) {
        systemPrompt += `\n\n## User Profile:\nName: ${userProfile.name ?? 'Unknown'}\nEmail: ${userProfile.email ?? 'Unknown'}\nRole: ${userRole}`;
      }
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, type: true },
      });
      if (workspace) {
        systemPrompt += `\n\n## Workspace Info:\nName: ${workspace.name ?? 'Unknown'}\nType: ${workspace.type}`;
      }
      systemPrompt += `\n\n## Instructions:\nPlease provide concise, accurate, and helpful responses considering user profile and workspace context.`;

      this.logger.debug(`System prompt:\n${systemPrompt}`);

      const interpolatedMessages = messages.map((msg) =>
        msg.role === 'user' && typeof msg.content === 'string'
          ? {
              ...msg,
              content: this.contextResolution.interpolateVariables(
                msg.content,
                contextChain.variables,
              ),
            }
          : msg,
      );

      const allMessages = [...conversationHistory, ...interpolatedMessages];
      const finalMessages = this.buildMessagesWithSystemPrompt(
        allMessages,
        systemPrompt,
        params.systemPrompt !== undefined,
      );

      // Provider and streaming setup
      const workspaceKey = await this.providerFactory.getWorkspaceApiKey(
        workspaceId,
        finalProvider,
      );
      if (!workspaceKey) {
        const errorMsg = `No ${finalProvider} API key configured for this workspace`;
        yield { type: 'error', error: errorMsg };
        await this.prisma.podExecution.update({
          where: { id: executionId },
          data: {
            status: PodExecutionStatus.ERROR,
            errorMessage: errorMsg,
            finishedAt: new Date(),
          },
        });
        this.flowGateway.broadcastExecutionError(pod.flowId, executionId, podId, errorMsg);
        return;
      }

      const { apiKey, keyId, customEndpoint } = workspaceKey;
      const llmProvider = this.providerFactory.getProvider(finalProvider);
      if (!llmProvider.executeStream) {
        yield { type: 'error', error: `Provider ${finalProvider} does not support streaming` };
        return;
      }

      const llmRequest: any = {
        provider: finalProvider,
        model: finalModel,
        messages: finalMessages,
        apiKey,
        customEndpoint,
        apiKeyId: keyId,
        workspaceId,
        stream: true,
        temperature: finalTemperature,
        maxTokens: finalMaxTokens,
        topP: finalTopP,
        presencePenalty: finalPresencePenalty,
        frequencyPenalty: finalFrequencyPenalty,
        thinkingBudget: finalThinkingBudget,
        responseFormat: finalResponseFormat,
      };

      yield { type: 'start', executionId };

      let fullContent = '';
      let finalUsage: any = null;
      let finishReason = 'stop';

      // Streaming tokens from LLM provider
      for await (const chunk of llmProvider.executeStream(llmRequest)) {
        yield chunk;
        if (chunk.type === 'token' && chunk.content) fullContent += chunk.content;
        if (chunk.type === 'done') {
          finalUsage = chunk.usage;
          finishReason = chunk.finishReason || 'stop';
        }
      }

      // Calculate cost/profit/credits for main LLM call
      if (finalUsage) {
        const pricing = await this.prisma.modelPricingTier.findFirst({
          where: { provider: finalProvider, modelId: finalModel, isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (pricing) {
          const cost = calculateTokenCosts(
            {
              promptTokens: finalUsage.promptTokens,
              completionTokens: finalUsage.completionTokens,
              reasoningTokens: finalUsage.reasoningTokens,
            },
            {
              inputTokenCost: pricing.inputTokenCost,
              outputTokenCost: pricing.outputTokenCost,
              reasoningTokenCost: pricing.reasoningTokenCost,
            },
          );

          const markup = applyMarkup(cost.totalCostDecimal);
          const credits = settleCreditsCharge({ userChargeUsd: markup.userCharge });

          this.logger.log(
            `[Execution] 💰 COST DETAILS\n${formatCostBreakdown(cost, finalUsage)}\n${formatProfitBreakdown(
              {
                actual: markup.actual,
                userCharge: markup.userCharge,
                profit: markup.userCharge - markup.actual,
                marginPct: ((markup.userCharge - markup.actual) / markup.userCharge) * 100,
                roiPct: ((markup.userCharge - markup.actual) / markup.actual) * 100,
                credits,
              },
            )}`,
          );

          await this.prisma.podExecution.update({
            where: { id: executionId },
            data: {
              status: PodExecutionStatus.COMPLETED,
              finishedAt: new Date(),
              runtimeInMs: Date.now() - startTime,
              apiKeyId: keyId,
              inputTokens: finalUsage.promptTokens,
              outputTokens: finalUsage.completionTokens,
              reasoningTokens: finalUsage.reasoningTokens || 0,
              costInUsd: cost.totalCost,
              modelName: finalModel,
              responseMetadata: {
                content: fullContent,
                finishReason,
                profit: markup,
                creditsCharged: credits,
              },
            },
          });

          this.flowGateway.broadcastExecutionComplete(pod.flowId, executionId, podId, {
            content: fullContent,
            usage: finalUsage,
            profit: markup,
            creditsCharged: credits,
            runtime: Date.now() - startTime,
          });
        } else {
          // No pricing, still finalize record minimally
          await this.prisma.podExecution.update({
            where: { id: executionId },
            data: {
              status: PodExecutionStatus.COMPLETED,
              finishedAt: new Date(),
              runtimeInMs: Date.now() - startTime,
              apiKeyId: keyId,
              inputTokens: finalUsage.promptTokens,
              outputTokens: finalUsage.completionTokens,
              reasoningTokens: finalUsage.reasoningTokens || 0,
              modelName: finalModel,
              responseMetadata: {
                content: fullContent,
                finishReason,
              },
            },
          });
          this.flowGateway.broadcastExecutionComplete(pod.flowId, executionId, podId, {
            content: fullContent,
            usage: finalUsage,
            runtime: Date.now() - startTime,
          });
        }
      } else {
        await this.prisma.podExecution.update({
          where: { id: executionId },
          data: {
            status: PodExecutionStatus.COMPLETED,
            finishedAt: new Date(),
            runtimeInMs: Date.now() - startTime,
            modelName: finalModel,
            responseMetadata: {
              content: fullContent || 'Empty response',
              finishReason: 'unknown',
            },
          },
        });
        this.flowGateway.broadcastExecutionComplete(pod.flowId, executionId, podId, {
          content: fullContent || 'Empty response',
          runtime: Date.now() - startTime,
        });
      }

      // Generate embedding of combined user + assistant chat and save it
      try {
        const combinedTextForEmbedding = `User: ${userInput}\nAssistant: ${fullContent}`;
        const embedding = await this.contextResolution.generateTextEmbedding(
          combinedTextForEmbedding,
          workspaceId,
        );
        await this.contextResolution.saveChatEmbedding(
          workspaceId,
          userId,
          podId,
          executionId,
          combinedTextForEmbedding,
          embedding,
        );
        this.logger.debug(`[Execution] Chat embedding saved for execution ${executionId}`);
        // Optionally, here you could calculate & track embedding API call cost similarly if pricing available
      } catch (embeddingError) {
        this.logger.warn(
          `[Execution] Embedding generation/saving failed: ${
            embeddingError instanceof Error ? embeddingError.message : embeddingError
          }`,
        );
      }

      // Update pod final status
      await this.prisma.pod.update({
        where: { id: podId },
        data: {
          executionStatus: PodExecutionStatus.COMPLETED,
          lastExecutionId: executionId,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown streaming error';
      await this.prisma.podExecution.update({
        where: { id: executionId },
        data: {
          status: PodExecutionStatus.ERROR,
          finishedAt: new Date(),
          runtimeInMs: Date.now() - startTime,
          errorMessage,
        },
      });
      this.logger.error(`[Execution] ❌ ${executionId} failed: ${errorMessage}`, error);
      if (_podFlowId) {
        this.flowGateway.broadcastExecutionError(_podFlowId, executionId, podId, errorMessage);
      }
      yield { type: 'error', error: errorMessage };
    }
  }

  private async getPodConversationHistory(
    podId: string,
    limit: number = 20,
  ): Promise<LLMMessage[]> {
    const previousExecutions = await this.prisma.podExecution.findMany({
      where: {
        podId,
        status: 'COMPLETED',
      },
      orderBy: { finishedAt: 'desc' },
      take: limit,
      select: {
        requestMetadata: true,
        responseMetadata: true,
      },
    });

    const conversationHistory: LLMMessage[] = [];

    for (const exec of previousExecutions.reverse()) {
      const userInput = (exec.requestMetadata as any)?.userInput;
      const assistantOutput = this.extractOutputFromResponse(exec.responseMetadata);

      if (userInput) {
        conversationHistory.push({ role: 'user', content: userInput });
      }
      if (assistantOutput) {
        conversationHistory.push({ role: 'assistant', content: assistantOutput });
      }
    }

    return conversationHistory;
  }

  private extractOutputFromResponse(responseMetadata: any): string | null {
    try {
      // Streaming content format
      if (responseMetadata?.content && typeof responseMetadata.content === 'string') {
        return responseMetadata.content;
      }

      // Gemini format
      if (responseMetadata?.candidates?.[0]?.content?.parts) {
        const parts = responseMetadata.candidates[0].content.parts;
        return parts.map((p: any) => p.text || '').join('\n');
      }

      // OpenAI format
      if (responseMetadata?.choices?.[0]?.message?.content) {
        return responseMetadata.choices[0].message.content;
      }

      // Anthropic format
      if (Array.isArray(responseMetadata?.content)) {
        const textBlocks = responseMetadata.content.filter((block: any) => block.type === 'text');
        return textBlocks.map((block: any) => block.text).join('\n');
      }

      return null;
    } catch (err) {
      this.logger.error('Failed to extract output from response', err);
      return null;
    }
  }

  private async getPodConfig(pk: string, sk: string): Promise<LLMPromptPodContent | null> {
    try {
      const tableName = this.dynamoDb.getTableNames().pods;
      const item = (await this.dynamoDb.getItem(tableName, { pk, sk })) as any | null;
      return item?.content?.type === 'LLM_PROMPT' ? (item.content as LLMPromptPodContent) : null;
    } catch (err) {
      this.logger.error('Failed to fetch pod config from DynamoDB', err);
      return null;
    }
  }

  private buildMessagesWithSystemPrompt(
    messages: LLMMessage[],
    systemPrompt: string,
    _userProvidedSystemPrompt: boolean = false, // underscore to satisfy no-unused-vars
  ): LLMMessage[] {
    const hasSystemMessage = messages.some((m) => m.role === 'system');
    if (hasSystemMessage) {
      return messages;
    }
    return [{ role: 'system', content: systemPrompt }, ...messages];
  }

  async getPodExecutions(podId: string, limit: number = 10): Promise<ExecutionHistoryItemDto[]> {
    const executions = await this.prisma.podExecution.findMany({
      where: { podId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        podId: true,
        status: true,
        provider: true,
        modelId: true,
        modelName: true,
        inputTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        costInUsd: true,
        startedAt: true,
        finishedAt: true,
        runtimeInMs: true,
        errorMessage: true,
        errorCode: true,
      },
    });

    return executions.map((exec) => ({
      id: exec.id,
      podId: exec.podId,
      status: exec.status,
      provider: exec.provider,
      modelId: exec.modelId,
      modelName: exec.modelName,
      inputTokens: exec.inputTokens,
      outputTokens: exec.outputTokens,
      reasoningTokens: exec.reasoningTokens,
      costInUsd: exec.costInUsd ? exec.costInUsd.toString() : null,
      startedAt: exec.startedAt,
      finishedAt: exec.finishedAt,
      runtimeInMs: exec.runtimeInMs,
      errorMessage: exec.errorMessage,
      errorCode: exec.errorCode,
    }));
  }

  async getExecution(executionId: string): Promise<ExecutionDetailDto> {
    const execution = await this.prisma.podExecution.findUnique({
      where: { id: executionId },
      include: {
        pod: {
          select: {
            id: true,
            type: true,
            flowId: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    return {
      ...execution,
      costInUsd: execution.costInUsd ? execution.costInUsd.toString() : null,
    } as ExecutionDetailDto;
  }
}
