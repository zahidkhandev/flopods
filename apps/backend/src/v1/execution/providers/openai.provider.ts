import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LLMProvider } from '@actopod/schema';
import { LLMRequest, LLMResponse } from '../types/llm-provider.types';
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

      // Check if model supports reasoning tokens
      const modelPricing = await this.getModelPricing(LLMProvider.OPENAI, request.model);
      const isReasoningModel = (modelPricing?.creditsPerMillionReasoningTokens ?? 0) > 0;

      const requestBody: any = {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        stream: false,
      };

      // Only add these params for non-reasoning models
      if (!isReasoningModel) {
        if (request.maxTokens) requestBody.max_tokens = request.maxTokens;
        if (request.topP) requestBody.top_p = request.topP;
        if (request.presencePenalty) requestBody.presence_penalty = request.presencePenalty;
        if (request.frequencyPenalty) requestBody.frequency_penalty = request.frequencyPenalty;
        if (request.responseFormat) {
          requestBody.response_format = { type: request.responseFormat };
        }
      } else {
        // Reasoning models only support max_completion_tokens
        if (request.maxTokens) {
          requestBody.max_completion_tokens = request.maxTokens;
        }
      }

      const response = await this.retryWithBackoff(() =>
        axios.post(`${baseUrl}/chat/completions`, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${request.apiKey}`,
          },
          timeout: 180000, // 3 minutes for reasoning models
        }),
      );

      const data = response.data;
      const choice = data.choices[0];

      return {
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
    } catch (error) {
      this.handleError(error, 'OpenAI');
    }
  }

  async testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean> {
    try {
      const baseUrl = customEndpoint || this.defaultBaseUrl;
      await axios.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const dbModels = await this.getModelsFromDb(LLMProvider.OPENAI);
    if (dbModels.length > 0) return dbModels;

    return [
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
  }
}
