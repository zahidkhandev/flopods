import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BaseLLMProvider } from './base-llm.provider';
import { LLMProvider } from '@actopod/schema';
import { LLMRequest, LLMResponse } from '../types/llm-provider.types';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GeminiProvider extends BaseLLMProvider {
  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(prisma: PrismaService) {
    super('GeminiProvider', prisma);
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      const baseUrl = request.customEndpoint || this.defaultBaseUrl;

      // Convert messages to Gemini format
      const contents = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        }));

      // System instruction
      const systemMessage = request.messages.find((m) => m.role === 'system');

      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 8192,
        },
      };

      if (systemMessage) {
        requestBody.systemInstruction = {
          parts: [
            {
              text:
                typeof systemMessage.content === 'string'
                  ? systemMessage.content
                  : JSON.stringify(systemMessage.content),
            },
          ],
        };
      }

      // Thinking budget for 2.5 models
      if (request.thinkingBudget && request.model.includes('2.5')) {
        requestBody.generationConfig.thinking_config = {
          budget_tokens: request.thinkingBudget,
        };
      }

      if (request.topP) requestBody.generationConfig.topP = request.topP;
      if (request.responseFormat === 'json_object') {
        requestBody.generationConfig.response_mime_type = 'application/json';
      }

      const response = await this.retryWithBackoff(() =>
        axios.post(
          `${baseUrl}/models/${request.model}:generateContent?key=${request.apiKey}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 180000,
          },
        ),
      );

      const data = response.data;
      const candidate = data.candidates[0];
      const content = candidate.content.parts.map((p: any) => p.text).join('\n');

      return {
        id: data.modelVersion || request.model,
        model: request.model,
        provider: LLMProvider.GOOGLE_GEMINI,
        content,
        finishReason: candidate.finishReason,
        usage: {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
          cachedTokens: data.usageMetadata.cachedContentTokenCount,
        },
        rawResponse: data,
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'Google Gemini');
    }
  }

  async testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean> {
    try {
      const baseUrl = customEndpoint || this.defaultBaseUrl;
      await axios.get(`${baseUrl}/models?key=${apiKey}`, {
        timeout: 10000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const dbModels = await this.getModelsFromDb(LLMProvider.GOOGLE_GEMINI);
    if (dbModels.length > 0) return dbModels;

    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
    ];
  }
}
