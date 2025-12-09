// apps/backend/src/v1/execution/providers/gemini.provider.ts
import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { BaseLLMProvider } from './base-llm.provider';
import { LLMProvider } from '@flopods/schema';
import { LLMRequest, LLMResponse, LLMStreamChunk } from '../types/llm-provider.types';
import { PrismaService } from '../../../prisma/prisma.service';

import { PROFIT_CONFIG } from '../../../common/config/profit.config';
import {
  calculateTokenCosts as calculateLLMExecutionCost,
  formatCostBreakdown,
  formatProfitBreakdown,
  applyMarkup,
  settleCreditsCharge,
} from '../../../common/utils/profit-and-credits';

@Injectable()
export class GeminiProvider extends BaseLLMProvider {
  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly REQUEST_TIMEOUT = 180000;
  private readonly API_KEY_TEST_TIMEOUT = 10000;

  constructor(prisma: PrismaService) {
    super('GeminiProvider', prisma);
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      this.validateRequest(request);

      const baseUrl = this.sanitizeUrl(request.customEndpoint || this.defaultBaseUrl);
      const contents = this.convertMessagesToGeminiFormat(request.messages);

      if (contents.length === 0) {
        throw new Error('No valid messages to send after filtering system messages');
      }

      const requestBody = this.buildRequestBody(request, contents);

      this.logger.debug(
        `[Gemini] Executing: model=${request.model}, messages=${request.messages.length}`,
      );

      const response = await this.retryWithBackoff(() =>
        axios.post(
          `${baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: this.REQUEST_TIMEOUT,
            validateStatus: (status) => status < 500,
          },
        ),
      );

      if (response.status === 429) {
        this.logger.warn('[Gemini] Rate limit hit - retry after delay');
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      if (response.status === 401 || response.status === 403) {
        this.logger.error('[Gemini] Invalid API key');
        throw new Error('Invalid or unauthorized API key');
      }

      if (response.status >= 400) {
        const errorMessage = response.data?.error?.message || 'Unknown API error';
        this.logger.error(`[Gemini] HTTP ${response.status}: ${errorMessage}`);
        throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
      }

      const data = this.validateResponse(response.data);
      const llmResponse = this.parseResponse(data, request.model);

      // Cost & profit tracking
      if (request.workspaceId) {
        try {
          const modelPricing = await this.getModelPricing(LLMProvider.GOOGLE_GEMINI, request.model);

          if (!modelPricing) {
            this.logger.warn(
              `[Gemini] No pricing found for ${request.model} - skipping cost calculation`,
            );
          } else {
            const costBreakdown = calculateLLMExecutionCost(
              {
                promptTokens: llmResponse.usage.promptTokens,
                completionTokens: llmResponse.usage.completionTokens,
                reasoningTokens: llmResponse.usage.reasoningTokens,
              },
              {
                inputTokenCost: modelPricing.inputTokenCost,
                outputTokenCost: modelPricing.outputTokenCost,
                reasoningTokenCost: modelPricing.reasoningTokenCost ?? 0,
              },
            );

            // Apply global markup (8x by default)
            const { actual, userCharge } = applyMarkup(costBreakdown.totalCost);

            // Compute credits to subtract (≥ 1 and ≥ any prior suggestion if you have one)
            const creditsCharged = settleCreditsCharge({
              userChargeUsd: userCharge,
            });

            // Persist execution cost record
            await this.recordExecutionCost(
              request.workspaceId,
              `gemini_${data.modelVersion || request.model}_${Date.now()}`,
              request.model,
              LLMProvider.GOOGLE_GEMINI,
              {
                promptTokens: llmResponse.usage.promptTokens,
                completionTokens: llmResponse.usage.completionTokens,
                reasoningTokens: llmResponse.usage.reasoningTokens,
              },
              {
                actualCostUsd: actual,
                userChargeUsd: userCharge,
                profitUsd: userCharge - actual,
              },
            );

            // Log nicely (compat accepts both styles)
            this.logger.log(
              `✅ Gemini: ${llmResponse.usage.totalTokens} tokens\n` +
                `${formatCostBreakdown(costBreakdown, {
                  promptTokens: llmResponse.usage.promptTokens,
                  completionTokens: llmResponse.usage.completionTokens,
                  reasoningTokens: llmResponse.usage.reasoningTokens,
                })}\n` +
                formatProfitBreakdown({
                  actual,
                  userCharge,
                  profit: userCharge - actual,
                  marginPct: userCharge > 0 ? ((userCharge - actual) / userCharge) * 100 : 0,
                  roiPct: actual > 0 ? ((userCharge - actual) / actual) * 100 : 0,
                  credits: creditsCharged,
                }),
            );

            // Attach to response
            llmResponse.profit = {
              actualCostUsd: actual,
              userChargeUsd: userCharge,
              profitUsd: userCharge - actual,
              profitMarginPercentage:
                userCharge > 0 ? ((userCharge - actual) / userCharge) * 100 : 0,
              roi: actual > 0 ? ((userCharge - actual) / actual) * 100 : 0,
              markupMultiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
              creditsCharged,
            };
          }
        } catch (costError) {
          this.logger.error(
            `[Gemini] Cost calculation failed: ${
              costError instanceof Error ? costError.message : String(costError)
            }`,
          );
          // continue without blocking the main response
        }
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `✅ Gemini completed: ${llmResponse.usage.totalTokens} tokens in ${executionTime}ms`,
      );

      return llmResponse;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `❌ Gemini execution failed after ${executionTime}ms: ${this.getErrorMessage(error)}`,
      );
      this.handleError(error, 'Google Gemini');
    }
  }

  async *executeStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    try {
      this.validateRequest(request);

      const baseUrl = this.sanitizeUrl(request.customEndpoint || this.defaultBaseUrl);
      const contents = this.convertMessagesToGeminiFormat(request.messages);

      if (contents.length === 0) {
        throw new Error('No valid messages to send');
      }

      const requestBody = this.buildRequestBody(request, contents);

      this.logger.debug(`[Gemini Stream] Starting: model=${request.model}`);

      const response = await axios.post(
        `${baseUrl}/models/${request.model}:streamGenerateContent?key=${request.apiKey}&alt=sse`,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'stream',
          timeout: this.REQUEST_TIMEOUT,
        },
      );

      yield { type: 'start' };

      let buffer = '';
      let totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      let hasContent = false;
      let finishReason = 'STOP';
      let fullContent = '';
      let chunkCount = 0;

      for await (const chunk of response.data) {
        try {
          const chunkStr = chunk.toString();
          buffer += chunkStr;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const jsonStr = trimmedLine.substring(6);
            if (!jsonStr || jsonStr === '{}') continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.candidates && Array.isArray(data.candidates)) {
                for (const candidate of data.candidates) {
                  if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                    for (const part of candidate.content.parts) {
                      if (part.text && typeof part.text === 'string' && part.text.length > 0) {
                        hasContent = true;
                        fullContent += part.text;
                        chunkCount++;
                        yield { type: 'token', content: part.text };
                      }
                    }
                  }
                  if (candidate.finishReason) finishReason = candidate.finishReason;
                }
              }

              if (data.usageMetadata) {
                totalUsage = {
                  promptTokens: data.usageMetadata.promptTokenCount || 0,
                  completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: data.usageMetadata.totalTokenCount || 0,
                };
              }
            } catch {
              // skip malformed chunk
            }
          }
        } catch {
          // continue on chunk errors
        }
      }

      // Process trailing buffer (best-effort)
      const b = buffer.trim();
      if (b.startsWith('data: ')) {
        const jsonStr = b.substring(6);
        if (jsonStr && jsonStr !== '{}') {
          try {
            const data = JSON.parse(jsonStr);

            if (data.candidates && Array.isArray(data.candidates)) {
              for (const candidate of data.candidates) {
                if (candidate.content?.parts && Array.isArray(candidate.content.parts)) {
                  for (const part of candidate.content.parts) {
                    if (part.text && typeof part.text === 'string' && part.text.length > 0) {
                      hasContent = true;
                      fullContent += part.text;
                      chunkCount++;
                      yield { type: 'token', content: part.text };
                    }
                  }
                }
              }
            }

            if (data.usageMetadata) {
              totalUsage = {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
              };
            }
          } catch {
            // ignore
          }
        }
      }

      // Cost logging (stream)
      if (request.workspaceId) {
        try {
          const modelPricing = await this.getModelPricing(LLMProvider.GOOGLE_GEMINI, request.model);
          if (!modelPricing) {
            this.logger.warn(`[Gemini Stream] No pricing found for ${request.model}`);
          } else {
            const costBreakdown = calculateLLMExecutionCost(
              {
                promptTokens: totalUsage.promptTokens,
                completionTokens: totalUsage.completionTokens,
                reasoningTokens: 0,
              },
              {
                inputTokenCost: modelPricing.inputTokenCost,
                outputTokenCost: modelPricing.outputTokenCost,
                reasoningTokenCost: modelPricing.reasoningTokenCost ?? 0,
              },
            );

            const { actual, userCharge } = applyMarkup(costBreakdown.totalCost);
            const creditsCharged = settleCreditsCharge({ userChargeUsd: userCharge });

            await this.recordExecutionCost(
              request.workspaceId,
              `gemini_stream_${Date.now()}`,
              request.model,
              LLMProvider.GOOGLE_GEMINI,
              {
                promptTokens: totalUsage.promptTokens,
                completionTokens: totalUsage.completionTokens,
              },
              {
                actualCostUsd: actual,
                userChargeUsd: userCharge,
                profitUsd: userCharge - actual,
              },
            );

            this.logger.log(
              `[Gemini Stream] Cost: ${formatCostBreakdown(costBreakdown, {
                promptTokens: totalUsage.promptTokens,
                completionTokens: totalUsage.completionTokens,
              })}\n` +
                formatProfitBreakdown({
                  actual,
                  userCharge,
                  profit: userCharge - actual,
                  marginPct: userCharge > 0 ? ((userCharge - actual) / userCharge) * 100 : 0,
                  roiPct: actual > 0 ? ((userCharge - actual) / actual) * 100 : 0,
                  credits: creditsCharged,
                }),
            );
          }
        } catch (costError) {
          this.logger.error(
            `[Gemini Stream] Cost calculation failed: ${
              costError instanceof Error ? costError.message : String(costError)
            }`,
          );
        }
      }

      yield {
        type: 'done',
        finishReason,
        usage: totalUsage,
      };

      if (!hasContent) {
        this.logger.warn(`[Gemini Stream] ⚠️ Completed with NO content`);
      } else {
        this.logger.log(
          `✅ Gemini stream: ${totalUsage.totalTokens} tokens, ${chunkCount} chunks, ${fullContent.length} chars`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Gemini stream failed: ${this.getErrorMessage(error)}`);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      };
    }
  }

  private validateRequest(request: LLMRequest): void {
    if (
      !request.apiKey ||
      typeof request.apiKey !== 'string' ||
      request.apiKey.trim().length === 0
    ) {
      throw new Error('Invalid API key');
    }
    if (!request.model || typeof request.model !== 'string') {
      throw new Error('Invalid model');
    }
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Invalid messages');
    }
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2');
    }
    if (request.maxTokens !== undefined && (request.maxTokens < 1 || request.maxTokens > 65536)) {
      throw new Error('maxTokens must be between 1 and 65536');
    }
    if (request.topP !== undefined && (request.topP < 0 || request.topP > 1)) {
      throw new Error('topP must be between 0 and 1');
    }
  }

  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.replace(/\/$/, '');
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  private convertMessagesToGeminiFormat(messages: LLMRequest['messages']) {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (!m.role || !m.content) {
          this.logger.warn(`[Gemini] Skipping invalid message`);
          return null;
        }

        const text =
          typeof m.content === 'string'
            ? m.content
            : typeof m.content === 'object'
              ? JSON.stringify(m.content)
              : String(m.content);

        if (text.length === 0) return null;

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text }],
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }

  private buildRequestBody(request: LLMRequest, contents: any[]): any {
    const requestBody: any = { contents };
    const generationConfig: any = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined && request.maxTokens > 0) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }
    if (request.topP !== undefined) {
      generationConfig.topP = request.topP;
    }
    if (request.responseFormat === 'json_object') {
      generationConfig.response_mime_type = 'application/json';
    }
    if (request.thinkingBudget && request.model.includes('2.5')) {
      generationConfig.thinking_config = { budget_tokens: request.thinkingBudget };
    }
    if (Object.keys(generationConfig).length > 0) {
      requestBody.generationConfig = generationConfig;
    }

    const systemMessage = request.messages.find((m) => m.role === 'system');
    if (systemMessage && systemMessage.content) {
      const systemText =
        typeof systemMessage.content === 'string'
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
      if (systemText.length > 0) {
        requestBody.systemInstruction = { parts: [{ text: systemText }] };
      }
    }

    requestBody.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ];

    return requestBody;
  }

  private validateResponse(data: any): any {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response: not an object');
    }
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }
    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error('No candidates returned from Gemini');
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Content blocked due to safety concerns');
    }
    if (!candidate.content || !Array.isArray(candidate.content.parts)) {
      throw new Error('Invalid candidate structure');
    }

    return data;
  }

  private parseResponse(data: any, model: string): LLMResponse {
    const candidate = data.candidates[0];

    const content = candidate.content.parts
      .map((p: any) => p.text || '')
      .filter((text: string) => text.length > 0)
      .join('\n');

    return {
      id: data.modelVersion || model,
      model,
      provider: LLMProvider.GOOGLE_GEMINI,
      content,
      finishReason: candidate.finishReason || 'unknown',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
        reasoningTokens: data.usageMetadata?.reasoningTokenCount || 0,
        cachedTokens: data.usageMetadata?.cachedContentTokenCount || 0,
      },
      rawResponse: data,
      timestamp: new Date(),
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        return data.error?.message || data.message || axiosError.message;
      }
      return axiosError.message;
    }
    return String(error);
  }

  async testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean> {
    try {
      if (!apiKey || apiKey.trim().length === 0) return false;

      const baseUrl = this.sanitizeUrl(customEndpoint || this.defaultBaseUrl);
      const response = await axios.get(`${baseUrl}/models?key=${apiKey}`, {
        timeout: this.API_KEY_TEST_TIMEOUT,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        this.logger.log('✅ Gemini API key valid');
        return true;
      }

      this.logger.warn(`❌ Gemini API key validation failed with status ${response.status}`);
      return false;
    } catch (error) {
      this.logger.error(`❌ Gemini API key test failed: ${this.getErrorMessage(error)}`);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const dbModels = await this.getModelsFromDb(LLMProvider.GOOGLE_GEMINI);
      if (dbModels.length === 0) {
        this.logger.warn('⚠️ No Gemini models in database - please seed ModelPricingTier');
        return [];
      }
      this.logger.debug(`✅ Loaded ${dbModels.length} Gemini models from database`);
      return dbModels;
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch Gemini models: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
