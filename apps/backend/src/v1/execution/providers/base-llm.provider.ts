import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ILLMProvider, LLMRequest, LLMResponse } from '../types/llm-provider.types';
import { LLMProvider, ModelPricingTier } from '@actopod/schema';

export abstract class BaseLLMProvider implements ILLMProvider {
  protected readonly logger: Logger;

  constructor(
    providerName: string,
    protected readonly prisma: PrismaService,
  ) {
    this.logger = new Logger(providerName);
  }

  abstract execute(request: LLMRequest): Promise<LLMResponse>;
  abstract testApiKey(apiKey: string, customEndpoint?: string): Promise<boolean>;
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Get active models from database for this provider
   */
  protected async getModelsFromDb(provider: LLMProvider): Promise<string[]> {
    try {
      const models = await this.prisma.modelPricingTier.findMany({
        where: {
          provider,
          isActive: true,
        },
        select: {
          modelId: true,
          displayName: true,
        },
        orderBy: {
          displayName: 'asc',
        },
      });

      return models.map((m) => m.modelId);
    } catch (error) {
      this.logger.warn(
        `Failed to fetch models from DB: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get model pricing info from database
   */
  protected async getModelPricing(
    provider: LLMProvider,
    modelId: string,
  ): Promise<ModelPricingTier | null> {
    try {
      return await this.prisma.modelPricingTier.findFirst({
        where: {
          provider,
          modelId,
          isActive: true,
        },
        orderBy: {
          effectiveFrom: 'desc',
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to fetch pricing for ${modelId}:`, error);
      return null;
    }
  }

  /**
   * Handle common errors with better messaging
   */
  protected handleError(error: any, provider: string): never {
    this.logger.error(`${provider} execution failed:`, error);

    const status = error.response?.status;
    const errorData = error.response?.data;

    if (status === 401 || status === 403) {
      throw new Error(`Invalid or expired API key for ${provider}`);
    }
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      throw new Error(
        `Rate limit exceeded for ${provider}${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`,
      );
    }
    if (status === 400) {
      const message = errorData?.error?.message || errorData?.message || 'Bad request';
      throw new Error(`${provider} bad request: ${message}`);
    }
    if (status === 404) {
      throw new Error(`${provider} endpoint not found. Check your configuration.`);
    }
    if (status === 500 || status === 503) {
      throw new Error(`${provider} service unavailable. Please try again later.`);
    }

    const message = error.message || 'Unknown error';
    throw new Error(`${provider} execution failed: ${message}`);
  }

  /**
   * Retry with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        // Don't retry on auth or bad request errors
        if (
          error.response?.status === 401 ||
          error.response?.status === 403 ||
          error.response?.status === 400
        ) {
          throw error;
        }

        if (i === maxRetries - 1) throw error;

        const delay = baseDelay * Math.pow(2, i);
        this.logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}
