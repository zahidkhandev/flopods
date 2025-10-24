// execution.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DynamoDbService } from '../../common/aws/dynamodb/dynamodb.service';
import { ProviderFactory } from './providers/provider.factory';
import { LLMProvider, PodExecutionStatus, PodType } from '@actopod/schema';
import {
  ExecutionResultDto,
  ExecutionHistoryItemDto,
  ExecutionDetailDto,
} from './dto/execution-response.dto';
import { DynamoPodItem, LLMPromptPodContent } from '../pods/types/pod-content.types';
import { nanoid } from 'nanoid';

type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

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
  ) {}

  /**
   * Execute a pod (called by controller - creates execution and returns immediately or queues)
   */
  async executePod(params: {
    podId: string;
    workspaceId: string;
    userId: string;
    messages: LLMMessage[];
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    thinkingBudget?: number;
    async?: boolean;
  }): Promise<ExecutionResultDto | { executionId: string; status: string }> {
    const { podId, workspaceId, async } = params;

    // Validate pod exists and belongs to workspace
    const pod = await this.prisma.pod.findFirst({
      where: {
        id: podId,
        flow: { workspaceId },
      },
      select: {
        flowId: true,
        id: true,
        type: true,
        dynamoPartitionKey: true,
        dynamoSortKey: true,
      },
    });

    if (!pod) {
      throw new NotFoundException(`Pod ${podId} not found in workspace ${workspaceId}`);
    }

    if (pod.type !== PodType.LLM_PROMPT) {
      throw new BadRequestException('Only LLM_PROMPT pods can be executed');
    }

    // Fetch pod config to get provider and model for execution record
    const podConfig = await this.getPodConfig(pod.dynamoPartitionKey, pod.dynamoSortKey);
    if (!podConfig) {
      throw new NotFoundException('Pod configuration not found');
    }

    const finalProvider = params.provider ?? podConfig.config.provider;
    const finalModel = params.model ?? podConfig.config.model;

    // Create execution record with QUEUED or RUNNING status
    // FIX: Include required provider and modelId fields
    const executionId = `exec_${nanoid(16)}`;
    const execution = await this.prisma.podExecution.create({
      data: {
        id: executionId,
        podId,
        flowId: pod.flowId,
        workspaceId,
        status: async ? PodExecutionStatus.QUEUED : PodExecutionStatus.RUNNING,
        provider: finalProvider, // FIXED: Required field
        modelId: finalModel, // FIXED: Required field
        startedAt: new Date(),
      },
    });

    // If async mode, return immediately with execution ID
    if (async) {
      return {
        executionId: execution.id,
        status: 'queued',
      };
    }

    // Otherwise, execute synchronously
    return this.executePodInternal({
      executionId: execution.id,
      podId,
      workspaceId,
      userId: params.userId,
      messages: params.messages,
      provider: params.provider,
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      thinkingBudget: params.thinkingBudget,
    });
  }

  /**
   * Internal execution method (called by queue worker or synchronously)
   */
  async executePodInternal(params: {
    executionId: string;
    podId: string;
    workspaceId: string;
    userId: string;
    messages: LLMMessage[];
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    thinkingBudget?: number;
  }): Promise<ExecutionResultDto> {
    const { executionId, podId, workspaceId, messages } = params;

    const execution = await this.prisma.podExecution.findUnique({
      where: { id: executionId },
      include: {
        pod: {
          select: {
            flowId: true,
            type: true,
            dynamoPartitionKey: true,
            dynamoSortKey: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    try {
      // Fetch pod configuration from DynamoDB
      const podConfig = await this.getPodConfig(
        execution.pod.dynamoPartitionKey,
        execution.pod.dynamoSortKey,
      );

      if (!podConfig) {
        throw new NotFoundException('Pod configuration not found');
      }

      // Merge pod config with runtime overrides
      const finalProvider = params.provider ?? podConfig.config.provider;
      const finalModel = params.model ?? podConfig.config.model;
      const finalTemperature = params.temperature ?? podConfig.config.temperature ?? 0.7;
      const finalMaxTokens = params.maxTokens ?? podConfig.config.maxTokens ?? 4096;
      const finalThinkingBudget = params.thinkingBudget ?? podConfig.config.thinkingBudget;

      // Build messages with system prompt defaults
      const finalMessages = this.buildMessagesWithSystemPrompt(
        messages,
        podConfig.config.systemPrompt,
      );

      this.logger.debug(
        `Executing ${executionId}: ${finalProvider}/${finalModel} | temp=${finalTemperature} | maxTokens=${finalMaxTokens}`,
      );

      // Update execution to RUNNING if it was QUEUED
      await this.prisma.podExecution.update({
        where: { id: executionId },
        data: {
          status: PodExecutionStatus.RUNNING,
          provider: finalProvider,
          modelId: finalModel,
        },
      });

      // Get workspace API key
      const workspaceKey = await this.providerFactory.getWorkspaceApiKey(
        workspaceId,
        finalProvider,
      );

      if (!workspaceKey) {
        throw new BadRequestException(
          `No ${finalProvider} API key configured for this workspace. Please add one in settings.`,
        );
      }

      const { apiKey, keyId, customEndpoint } = workspaceKey;

      // Get model pricing
      const pricing = await this.prisma.modelPricingTier.findFirst({
        where: { provider: finalProvider, modelId: finalModel, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (!pricing) {
        throw new BadRequestException(
          `Model ${finalModel} not found for provider ${finalProvider}`,
        );
      }

      // Execute LLM request
      const llmProvider = this.providerFactory.getProvider(finalProvider);
      const response = await llmProvider.execute({
        provider: finalProvider,
        model: finalModel,
        messages: finalMessages,
        apiKey,
        customEndpoint,
        apiKeyId: keyId,
        temperature: finalTemperature,
        maxTokens: finalMaxTokens,
        thinkingBudget: finalThinkingBudget,
        topP: podConfig.config.topP,
        presencePenalty: podConfig.config.presencePenalty,
        frequencyPenalty: podConfig.config.frequencyPenalty,
        responseFormat: podConfig.config.responseFormat,
      });

      // Calculate costs
      const inputCost = (response.usage.promptTokens / 1_000_000) * Number(pricing.inputTokenCost);
      const outputCost =
        (response.usage.completionTokens / 1_000_000) * Number(pricing.outputTokenCost);
      const reasoningCost =
        ((response.usage.reasoningTokens || 0) / 1_000_000) * Number(pricing.reasoningTokenCost);
      const totalCost = inputCost + outputCost + reasoningCost;

      // Update execution
      await this.prisma.podExecution.update({
        where: { id: executionId },
        data: {
          status: PodExecutionStatus.COMPLETED,
          finishedAt: new Date(),
          runtimeInMs: Date.now() - execution.startedAt.getTime(),
          apiKeyId: keyId,
          inputTokens: response.usage.promptTokens,
          outputTokens: response.usage.completionTokens,
          reasoningTokens: response.usage.reasoningTokens || 0,
          creditsConsumed: 0,
          costInUsd: totalCost,
          modelName: response.model,
          responseMetadata: response.rawResponse,
        },
      });

      // Track usage
      await this.providerFactory.trackApiKeyUsage(
        keyId,
        {
          input: response.usage.promptTokens,
          output: response.usage.completionTokens,
          reasoning: response.usage.reasoningTokens,
        },
        totalCost,
        true,
      );

      // Update pod status
      await this.prisma.pod.update({
        where: { id: podId },
        data: {
          executionStatus: PodExecutionStatus.COMPLETED,
          lastExecutionId: executionId,
        },
      });

      this.logger.log(
        `✅ Execution ${executionId} completed - ${response.usage.totalTokens} tokens, $${totalCost.toFixed(6)}`,
      );

      return {
        executionId,
        content: response.content,
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          reasoningTokens: response.usage.reasoningTokens,
          cachedTokens: response.usage.cachedTokens,
        },
        cost: {
          inputCost,
          outputCost,
          reasoningCost,
          totalCost,
        },
      };
    } catch (error) {
      // Handle failure
      await Promise.all([
        this.prisma.podExecution.update({
          where: { id: executionId },
          data: {
            status: PodExecutionStatus.ERROR,
            finishedAt: new Date(),
            runtimeInMs: Date.now() - execution.startedAt.getTime(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          },
        }),
        this.prisma.pod.update({
          where: { id: podId },
          data: {
            executionStatus: PodExecutionStatus.ERROR,
            lastExecutionId: executionId,
          },
        }),
      ]);

      this.logger.error(`❌ Execution ${executionId} failed:`, error);
      throw error;
    }
  }

  private async getPodConfig(pk: string, sk: string): Promise<LLMPromptPodContent | null> {
    try {
      const tableName = this.dynamoDb.getTableNames().pods;
      const item = (await this.dynamoDb.getItem(tableName, { pk, sk })) as DynamoPodItem | null;

      if (!item || item.content.type !== PodType.LLM_PROMPT) {
        return null;
      }

      return item.content as LLMPromptPodContent;
    } catch (error) {
      this.logger.error('Failed to fetch pod config from DynamoDB', error);
      return null;
    }
  }

  private buildMessagesWithSystemPrompt(
    messages: LLMMessage[],
    podSystemPrompt?: string,
  ): LLMMessage[] {
    const hasSystemMessage = messages.some((m) => m.role === 'system');

    if (hasSystemMessage) {
      this.logger.debug('Using user-provided system message');
      return messages;
    }

    const systemPrompt = podSystemPrompt || this.DEFAULT_SYSTEM_PROMPTS.general;

    this.logger.debug(
      `Using ${podSystemPrompt ? 'pod-configured' : 'default'} system prompt: "${systemPrompt.substring(0, 50)}..."`,
    );

    return [{ role: 'system', content: systemPrompt }, ...messages];
  }

  async getPodExecutions(podId: string, limit: number = 10): Promise<ExecutionHistoryItemDto[]> {
    const executions = await this.prisma.podExecution.findMany({
      where: { podId },
      orderBy: { startedAt: 'desc' },
      take: limit,
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
      ...exec,
      costInUsd: exec.costInUsd?.toString() || null,
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
      costInUsd: execution.costInUsd?.toString() || null,
    };
  }
}
