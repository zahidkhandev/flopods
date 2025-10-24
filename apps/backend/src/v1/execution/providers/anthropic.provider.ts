import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BaseLLMProvider } from './base-llm.provider';
import { LLMProvider } from '@actopod/schema';
import { LLMRequest, LLMResponse } from '../types/llm-provider.types';
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

      // Convert messages format for Anthropic
      const systemMessage = request.messages.find((m) => m.role === 'system');
      const userMessages = request.messages.filter((m) => m.role !== 'system');

      // Check model capabilities
      const modelPricing = await this.getModelPricing(LLMProvider.ANTHROPIC, request.model);
      const supportsExtendedThinking = modelPricing?.modelId?.includes('4-5') || false;

      const requestBody: any = {
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        messages: userMessages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      };

      // Add optional parameters
      if (systemMessage) {
        requestBody.system =
          typeof systemMessage.content === 'string'
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
      }
      if (request.temperature !== undefined) requestBody.temperature = request.temperature;
      if (request.topP !== undefined) requestBody.top_p = request.topP;

      // Extended thinking for Claude 4.5
      if (supportsExtendedThinking && request.thinkingBudget) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: request.thinkingBudget,
        };
      }

      const response = await this.retryWithBackoff(() =>
        axios.post(`${baseUrl}/messages`, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': request.apiKey,
            'anthropic-version': this.apiVersion,
          },
          timeout: 180000,
        }),
      );

      const data = response.data;

      // Extract text content (handle both text and thinking blocks)
      let content = '';
      if (Array.isArray(data.content)) {
        const textBlocks = data.content.filter((block: any) => block.type === 'text');
        content = textBlocks.map((block: any) => block.text).join('\n');
      } else {
        content = data.content[0]?.text || '';
      }

      return {
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
    } catch (error) {
      this.handleError(error, 'Anthropic');
    }
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
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const dbModels = await this.getModelsFromDb(LLMProvider.ANTHROPIC);
    if (dbModels.length > 0) return dbModels;

    return [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20250929',
      'claude-opus-4-1-20250808',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];
  }
}
