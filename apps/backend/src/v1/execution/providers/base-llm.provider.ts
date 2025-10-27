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

    // Handle specific HTTP status codes
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
    if (status === 502 || status === 504) {
      throw new Error(`${provider} gateway timeout. Please try again.`);
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error(`${provider} request timeout. Please try again.`);
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`${provider} network error. Check your internet connection.`);
    }

    // Generic error
    const message = error.message || 'Unknown error';
    throw new Error(`${provider} execution failed: ${message}`);
  }

  /**
   * Retry with exponential backoff and jitter
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx except 429)
        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          this.logger.warn(`Non-retryable error (${status}), failing immediately`);
          throw error;
        }

        // Don't retry if this is the last attempt
        if (attempt === maxRetries - 1) {
          this.logger.error(`Max retries (${maxRetries}) exceeded`);
          throw error;
        }

        // Calculate delay with exponential backoff + jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Random 0-1000ms jitter
        const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds

        this.logger.warn(
          `Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms (status: ${status || 'unknown'})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
