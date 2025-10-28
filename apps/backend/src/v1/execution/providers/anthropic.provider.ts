import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BaseLLMProvider } from './base-llm.provider';
import { LLMProvider } from '@flopods/schema';
import { LLMRequest, LLMResponse, LLMStreamChunk } from '../types/llm-provider.types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AnthropicProvider extends BaseLLMProvider {
  private readonly defaultBaseUrl = 'https://api.anthropic.com/v1';
  private readonly apiVersion = '2023-06-01';

  constructor(prisma: PrismaService) {
    super('AnthropicProvider', prisma);
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      const baseUrl = request.customEndpoint || this.defaultBaseUrl;

      const systemMessage = request.messages.find((m) => m.role === 'system');
      const userMessages = request.messages.filter((m) => m.role !== 'system');

      const modelPricing = await this.getModelPricing(LLMProvider.ANTHROPIC, request.model);
      const supportsExtendedThinking = modelPricing?.modelId?.includes('4-5') || false;

      const requestBody: any = {
        model: request.model,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        max_tokens: request.maxTokens ?? this.getDefaultMaxTokens(request.model),
      };

      if (systemMessage) {
        requestBody.system =
          typeof systemMessage.content === 'string'
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
      }

      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      if (request.topP !== undefined) {
        requestBody.top_p = request.topP;
      }

      if (supportsExtendedThinking && request.thinkingBudget) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: request.thinkingBudget,
        };
      }

      this.logger.debug(
        `Executing Anthropic request: model=${request.model}, max_tokens=${requestBody.max_tokens}`,
      );

      const response = await this.retryWithBackoff(() =>
        axios.post(`${baseUrl}/messages`, requestBody, {
          headers: this.getRequestHeaders(request.apiKey, request.model),
          timeout: 180000,
        }),
      );

      const data = response.data;

      let content = '';
      if (Array.isArray(data.content)) {
        const textBlocks = data.content.filter((block: any) => block.type === 'text');
        content = textBlocks.map((block: any) => block.text).join('\n');
      } else {
        content = data.content[0]?.text || '';
      }

      const result: LLMResponse = {
        id: data.id,
        model: data.model,
        provider: LLMProvider.ANTHROPIC,
        content,
        finishReason: data.stop_reason,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          cachedTokens: data.usage.cache_read_input_tokens,
        },
        rawResponse: data,
        timestamp: new Date(),
      };

      this.logger.log(`✅ Anthropic execution completed: ${result.usage.totalTokens} tokens`);

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Anthropic execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.handleError(error, 'Anthropic');
    }
  }

  async *executeStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    try {
      const baseUrl = request.customEndpoint || this.defaultBaseUrl;

      const systemMessage = request.messages.find((m) => m.role === 'system');
      const userMessages = request.messages.filter((m) => m.role !== 'system');

      const modelPricing = await this.getModelPricing(LLMProvider.ANTHROPIC, request.model);
      const supportsExtendedThinking = modelPricing?.modelId?.includes('4-5') || false;

      const requestBody: any = {
        model: request.model,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        max_tokens: request.maxTokens ?? this.getDefaultMaxTokens(request.model),
        stream: true,
      };

      if (systemMessage) {
        requestBody.system =
          typeof systemMessage.content === 'string'
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
      }

      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      if (request.topP !== undefined) {
        requestBody.top_p = request.topP;
      }

      if (supportsExtendedThinking && request.thinkingBudget) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: request.thinkingBudget,
        };
      }

      this.logger.debug(
        `Streaming Anthropic request: model=${request.model}, max_tokens=${requestBody.max_tokens}`,
      );

      const response = await axios.post(`${baseUrl}/messages`, requestBody, {
        headers: this.getRequestHeaders(request.apiKey, request.model),
        responseType: 'stream',
        timeout: 180000,
      });

      yield { type: 'start' };

      let buffer = '';
      let finalUsage: any = null;

      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.substring(6));

            if (data.type === 'content_block_delta') {
              if (data.delta?.type === 'text_delta' && data.delta?.text) {
                yield { type: 'token', content: data.delta.text };
              }
            }

            if (data.type === 'message_delta') {
              if (data.usage) {
                finalUsage = data.usage;
              }
            }

            if (data.type === 'message_stop') {
              if (finalUsage) {
                yield {
                  type: 'done',
                  finishReason: data.delta?.stop_reason || 'end_turn',
                  usage: {
                    promptTokens: finalUsage.input_tokens || 0,
                    completionTokens: finalUsage.output_tokens || 0,
                    totalTokens: (finalUsage.input_tokens || 0) + (finalUsage.output_tokens || 0),
                  },
                };
              } else {
                yield { type: 'done', finishReason: 'end_turn' };
              }
            }
          } catch {
            this.logger.warn(`Failed to parse SSE line: ${line}`);
          }
        }
      }

      this.logger.log(`✅ Anthropic stream completed`);
    } catch (error) {
      this.logger.error(
        `❌ Anthropic stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      };
    }
  }

  private getDefaultMaxTokens(model: string): number {
    // Claude 3.7 Sonnet - 128K output
    if (model.includes('claude-3-7')) {
      return 128000;
    }

    // Claude Sonnet 4 - 64K output
    if (model.includes('claude-sonnet-4') || model.includes('sonnet-4-5')) {
      return 64000;
    }

    // Claude Opus 4 - 32K output
    if (model.includes('claude-opus-4') || model.includes('opus-4-1')) {
      return 32000;
    }

    // Claude 3.5 Sonnet - 8K output (with special header)
    if (model.includes('claude-3-5-sonnet') || model.includes('3-5-sonnet')) {
      return 8192;
    }

    // Claude Haiku - 10K output
    if (model.includes('haiku')) {
      return 10000;
    }

    // Default for older models
    return 4096;
  }

  private getRequestHeaders(apiKey: string, model: string): any {
    const headers: any = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': this.apiVersion,
    };

    // Enable extended output for Claude 3.5 Sonnet
    if (model.includes('claude-3-5-sonnet')) {
      headers['anthropic-beta'] = 'max-tokens-3-5-sonnet-2024-07-15';
    }

    return headers;
  }

  async testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean> {
    try {
      const baseUrl = customEndpoint || this.defaultBaseUrl;
      await axios.post(
        `${baseUrl}/messages`,
        {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': this.apiVersion,
          },
          timeout: 10000,
        },
      );
      this.logger.log('✅ Anthropic API key validation successful');
      return true;
    } catch {
      this.logger.warn('Anthropic API key validation failed');
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const dbModels = await this.getModelsFromDb(LLMProvider.ANTHROPIC);
    if (dbModels.length > 0) {
      this.logger.debug(`Loaded ${dbModels.length} Anthropic models from database`);
      return dbModels;
    }

    const fallbackModels = [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20250929',
      'claude-opus-4-1-20250808',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];

    this.logger.debug(`Using ${fallbackModels.length} fallback Anthropic models`);
    return fallbackModels;
  }
}
