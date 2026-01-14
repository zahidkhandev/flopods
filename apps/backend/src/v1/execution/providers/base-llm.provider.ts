// src/modules/v1/llm/providers/base-llm.provider.ts

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ILLMProvider, LLMRequest, LLMResponse } from '../types/llm-provider.types';
import { LLMProvider, APIRequestType, ModelPricingTier } from '@flopods/schema'; // Add APIRequestType
import { PROFIT_CONFIG } from '../../../common/config/profit.config';
import { Decimal } from '@prisma/client/runtime/library';

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

  protected calculateProfit(
    modelPricing: ModelPricingTier,
    usage: {
      promptTokens: number;
      completionTokens: number;
      reasoningTokens?: number;
    },
  ): {
    actualCostUsd: number;
    userChargeUsd: number;
    profitUsd: number;
    profitMarginPercentage: number;
    roi: number;
  } {
    const inputCost = (usage.promptTokens / 1_000_000) * Number(modelPricing.inputTokenCost);
    const outputCost = (usage.completionTokens / 1_000_000) * Number(modelPricing.outputTokenCost);
    const reasoningCost = usage.reasoningTokens
      ? (usage.reasoningTokens / 1_000_000) * Number(modelPricing.reasoningTokenCost)
      : 0;

    const actualCostUsd = inputCost + outputCost + reasoningCost;

    const multiplier = PROFIT_CONFIG.MARKUP_MULTIPLIER;
    const userChargeUsd = actualCostUsd * multiplier;
    const profitUsd = userChargeUsd - actualCostUsd;
    const profitMarginPercentage = actualCostUsd > 0 ? (profitUsd / userChargeUsd) * 100 : 0;
    const roi = actualCostUsd > 0 ? (profitUsd / actualCostUsd) * 100 : 0;

    return {
      actualCostUsd,
      userChargeUsd,
      profitUsd,
      profitMarginPercentage,
      roi,
    };
  }

  protected async recordExecutionCost(
    workspaceId: string,
    executionId: string,
    model: string,
    provider: LLMProvider,
    usage: {
      promptTokens: number;
      completionTokens: number;
      reasoningTokens?: number;
    },
    profitData: {
      actualCostUsd: number;
      userChargeUsd: number;
      profitUsd: number;
    },
  ): Promise<void> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { id: true, isByokMode: true },
      });

      if (!subscription) return;

      await this.prisma.documentAPILog.create({
        data: {
          workspaceId,
          provider, // Use LLMProvider directly
          modelId: model,
          requestType: APIRequestType.TEXT_GENERATION, // Changed from 'TEXT_EXTRACTION'
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          totalTokens: usage.promptTokens + usage.completionTokens + (usage.reasoningTokens || 0),
          statusCode: 200,
          success: true,
          estimatedCost: new Decimal(profitData.actualCostUsd),
          actualCost: new Decimal(profitData.actualCostUsd),
          metadata: {
            executionId,
            profitUsd: profitData.profitUsd,
            userCharge: profitData.userChargeUsd,
            byokMode: subscription.isByokMode,
            reasoningTokens: usage.reasoningTokens || 0,
            multiplier: PROFIT_CONFIG.MARKUP_MULTIPLIER,
          },
        },
      });

      this.logger.debug(
        `[Profit] ${model}: Cost=$${profitData.actualCostUsd.toFixed(6)} | ` +
          `Charge=$${profitData.userChargeUsd.toFixed(6)} | ` +
          `Profit=$${profitData.profitUsd.toFixed(6)} (${PROFIT_CONFIG.profitMarginPercentage.toFixed(1)}%) ` +
          `${subscription.isByokMode ? '[BYOK=0]' : `[ROI=${PROFIT_CONFIG.roi.toFixed(0)}%]`}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to record execution cost: ${error}`);
    }
  }

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
    if (status === 502 || status === 504) {
      throw new Error(`${provider} gateway timeout. Please try again.`);
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error(`${provider} request timeout. Please try again.`);
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error(`${provider} network error. Check your internet connection.`);
    }

    const message = error.message || 'Unknown error';
    throw new Error(`${provider} execution failed: ${message}`);
  }

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

        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          this.logger.warn(`Non-retryable error (${status}), failing immediately`);
          throw error;
        }

        if (attempt === maxRetries - 1) {
          this.logger.error(`Max retries (${maxRetries}) exceeded`);
          throw error;
        }

        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const delay = Math.min(exponentialDelay + jitter, 30000);

        this.logger.warn(
          `Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms (status: ${status || 'unknown'})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
