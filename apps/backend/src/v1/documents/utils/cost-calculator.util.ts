// /src/modules/v1/documents/utils/cost-calculator.util.ts

import { PrismaService } from '../../../prisma/prisma.service';
import { LLMProvider } from '@flopods/schema';
import type { DocumentEmbeddingProvider } from '../types';

const CREDIT_VALUE = 0.0001;

/**
 * ✅ Get embedding pricing from DB
 */
export async function getEmbeddingProvider(
  prisma: PrismaService,
): Promise<DocumentEmbeddingProvider> {
  const pricing = await prisma.modelPricingTier.findFirst({
    where: {
      provider: LLMProvider.GOOGLE_GEMINI,
      modelId: 'embedding-001',
      isActive: true,
    },
    orderBy: {
      effectiveFrom: 'desc',
    },
  });

  if (!pricing) {
    throw new Error('Embedding pricing not found in database');
  }

  let providerConfig: any = {};
  if (pricing.providerConfig) {
    try {
      providerConfig = JSON.parse(pricing.providerConfig as string);
    } catch (e) {
      // Silent catch - use defaults
    }
  }

  return {
    model: pricing.modelId,
    dimensions: providerConfig.dimensions || 768,
    costPer1MTokens: Number(pricing.inputTokenCost),
  };
}

export function calculateDocumentEmbeddingCost(
  tokenCount: number,
  costPer1MTokens: number,
): number {
  if (tokenCount < 0) {
    throw new Error('Token count cannot be negative');
  }

  if (tokenCount === 0) {
    return 0;
  }

  const totalCost = (tokenCount / 1_000_000) * costPer1MTokens;
  return Math.round(totalCost * 100_000_000) / 100_000_000;
}

export function convertDocumentCostToCredits(costInUsd: number): number {
  if (costInUsd < 0) {
    throw new Error('Cost cannot be negative');
  }

  if (costInUsd === 0) {
    return 0;
  }

  const credits = Math.ceil(costInUsd / CREDIT_VALUE);
  return credits;
}

export async function estimateDocumentProcessingCost(
  tokenCount: number,
  prisma: PrismaService,
): Promise<{
  extractionCost: number;
  embeddingCost: number;
  totalCost: number;
  credits: number;
}> {
  const provider = await getEmbeddingProvider(prisma);

  const extractionCost = 0;
  const embeddingCost = calculateDocumentEmbeddingCost(tokenCount, provider.costPer1MTokens);
  const totalCost = extractionCost + embeddingCost;
  const credits = convertDocumentCostToCredits(totalCost);

  return {
    extractionCost,
    embeddingCost,
    totalCost,
    credits,
  };
}

export async function calculateDocumentCreditsFromTokens(
  tokenCount: number,
  prisma: PrismaService,
): Promise<number> {
  const provider = await getEmbeddingProvider(prisma);
  const cost = calculateDocumentEmbeddingCost(tokenCount, provider.costPer1MTokens);
  return convertDocumentCostToCredits(cost);
}
