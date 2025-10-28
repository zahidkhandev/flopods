import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LLMProvider } from '@flopods/schema';
import { LLMRequest, LLMResponse, LLMStreamChunk } from '../types/llm-provider.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { BaseLLMProvider } from './base-llm.provider';

@Injectable()
export class OpenAIProvider extends BaseLLMProvider {
  private readonly defaultBaseUrl = 'https://api.openai.com/v1';

  constructor(prisma: PrismaService) {
    super('OpenAIProvider', prisma);
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      const baseUrl = request.customEndpoint || this.defaultBaseUrl;

      const modelPricing = await this.getModelPricing(LLMProvider.OPENAI, request.model);
      const isReasoningModel = (modelPricing?.creditsPerMillionReasoningTokens ?? 0) > 0;

      const requestBody: any = {
        model: request.model,
        messages: request.messages,
        stream: false,
      };

      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      if (!isReasoningModel) {
        if (request.maxTokens !== undefined) {
          requestBody.max_tokens = request.maxTokens;
        }
        if (request.topP !== undefined) {
          requestBody.top_p = request.topP;
        }
        if (request.presencePenalty !== undefined) {
          requestBody.presence_penalty = request.presencePenalty;
        }
        if (request.frequencyPenalty !== undefined) {
          requestBody.frequency_penalty = request.frequencyPenalty;
        }
        if (request.responseFormat) {
          requestBody.response_format = { type: request.responseFormat };
        }
      } else {
        if (request.maxTokens !== undefined) {
          requestBody.max_completion_tokens = request.maxTokens;
        }
      }

      this.logger.debug(
        `Executing OpenAI request: model=${request.model}, isReasoning=${isReasoningModel}, temperature=${request.temperature ?? 'default'}, maxTokens=${request.maxTokens ?? 'default'}`,
      );

      const response = await this.retryWithBackoff(() =>
        axios.post(`${baseUrl}/chat/completions`, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${request.apiKey}`,
          },
          timeout: 180000,
        }),
      );

      const data = response.data;
      const choice = data.choices[0];

      const result: LLMResponse = {
        id: data.id,
        model: data.model,
        provider: LLMProvider.OPENAI,
        content: choice.message.content || '',
        finishReason: choice.finish_reason,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
          cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
        },
        rawResponse: data,
        timestamp: new Date(),
      };

      this.logger.log(
        `✅ OpenAI execution completed: ${result.usage.totalTokens} tokens (${result.usage.promptTokens} input + ${result.usage.completionTokens} output${result.usage.reasoningTokens ? ` + ${result.usage.reasoningTokens} reasoning` : ''})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ OpenAI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.handleError(error, 'OpenAI');
    }
  }

  async *executeStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    try {
      const baseUrl = request.customEndpoint || this.defaultBaseUrl;

      const modelPricing = await this.getModelPricing(LLMProvider.OPENAI, request.model);
      const isReasoningModel = (modelPricing?.creditsPerMillionReasoningTokens ?? 0) > 0;

      const requestBody: any = {
        model: request.model,
        messages: request.messages,
        stream: true,
        stream_options: { include_usage: true },
      };

      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      if (!isReasoningModel) {
        if (request.maxTokens !== undefined) {
          requestBody.max_tokens = request.maxTokens;
        }
        if (request.topP !== undefined) {
          requestBody.top_p = request.topP;
        }
        if (request.presencePenalty !== undefined) {
          requestBody.presence_penalty = request.presencePenalty;
        }
        if (request.frequencyPenalty !== undefined) {
          requestBody.frequency_penalty = request.frequencyPenalty;
        }
        if (request.responseFormat) {
          requestBody.response_format = { type: request.responseFormat };
        }
      } else {
        if (request.maxTokens !== undefined) {
          requestBody.max_completion_tokens = request.maxTokens;
        }
      }

      this.logger.debug(`Streaming OpenAI request: model=${request.model}`);

      const response = await axios.post(`${baseUrl}/chat/completions`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        responseType: 'stream',
        timeout: 180000,
      });

      yield { type: 'start' };

      let buffer = '';

      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.substring(6));
            const delta = data.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'token', content: delta.content };
            }

            if (data.choices?.[0]?.finish_reason) {
              const usage = data.usage;
              if (usage) {
                yield {
                  type: 'done',
                  finishReason: data.choices[0].finish_reason,
                  usage: {
                    promptTokens: usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
                    cachedTokens: usage.prompt_tokens_details?.cached_tokens,
                  },
                };
              } else {
                yield {
                  type: 'done',
                  finishReason: data.choices[0].finish_reason,
                };
              }
            }
          } catch {
            this.logger.warn(`Failed to parse SSE line: ${line}`);
          }
        }
      }

      this.logger.log(`✅ OpenAI stream completed`);
    } catch (error) {
      this.logger.error(
        `❌ OpenAI stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      };
    }
  }

  async testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean> {
    try {
      const baseUrl = customEndpoint || this.defaultBaseUrl;
      await axios.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      this.logger.log('✅ OpenAI API key validation successful');
      return true;
    } catch {
      this.logger.warn('OpenAI API key validation failed');
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const dbModels = await this.getModelsFromDb(LLMProvider.OPENAI);
    if (dbModels.length > 0) {
      this.logger.debug(`Loaded ${dbModels.length} OpenAI models from database`);
      return dbModels;
    }

    const fallbackModels = [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-5-pro',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o3',
      'o3-pro',
      'o4-mini',
      'gpt-4o',
      'gpt-4o-mini',
    ];

    this.logger.debug(`Using ${fallbackModels.length} fallback OpenAI models`);
    return fallbackModels;
  }
}
