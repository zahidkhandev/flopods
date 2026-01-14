import { PrismaService } from '../../../prisma/prisma.service';
import { LLMProvider } from '@flopods/schema';
import type { DocumentEmbeddingProvider } from '../types';
import { CREDIT_VALUE_USD } from '../../../common/utils/profit-and-credits';

/**
 * Central credit denomination (USD per 1 credit).
 * Keep this single source of truth for any credit math.
 */

/**
 * Get embedding pricing from DB (centralized)
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
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!pricing) throw new Error('Embedding pricing not found in database');

  let providerConfig: any = {};
  if (pricing.providerConfig) {
    try {
      providerConfig = JSON.parse(pricing.providerConfig as string);
    } catch {
      // ignore and use defaults
    }
  }

  return {
    model: pricing.modelId,
    dimensions: providerConfig.dimensions || 768,
    costPer1MTokens: Number(pricing.inputTokenCost),
  };
}

/**
 * USD cost for given token count against a per-1M token price.
 */
export function calculateDocumentEmbeddingCost(
  tokenCount: number,
  costPer1MTokens: number,
): number {
  if (tokenCount < 0) throw new Error('Token count cannot be negative');
  if (tokenCount === 0) return 0;

  const totalCost = (tokenCount / 1_000_000) * costPer1MTokens;
  // round to 1e-8 for stable decimals in DB
  return Math.round(totalCost * 100_000_000) / 100_000_000;
}

/**
 * Convert USD → platform credits (centralized).
 */
export function convertUsdToCredits(costInUsd: number): number {
  if (costInUsd < 0) throw new Error('Cost cannot be negative');
  if (costInUsd === 0) return 0;
  return Math.ceil(costInUsd / CREDIT_VALUE_USD.toNumber());
}

/**
 * Heuristic bytes → tokens (centralized, used for estimates).
 * Default rule: 1 MB ≈ 20 pages, 1 page ≈ 500 tokens  →  1 MB ≈ 10,000 tokens
 */
export function estimateTokensFromBytes(fileSizeBytes: number): number {
  if (fileSizeBytes <= 0) return 0;
  const tokensPerMB = 10_000;
  const tokens = (fileSizeBytes / (1024 * 1024)) * tokensPerMB;
  return Math.ceil(tokens);
}

/**
 * Full estimate pipeline (extraction is free here).
 */
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
  const credits = convertUsdToCredits(totalCost);

  return { extractionCost, embeddingCost, totalCost, credits };
}

/**
 * Convenience: tokens → credits, respecting current provider pricing.
 */
export async function calculateDocumentCreditsFromTokens(
  tokenCount: number,
  prisma: PrismaService,
): Promise<number> {
  const provider = await getEmbeddingProvider(prisma);
  const cost = calculateDocumentEmbeddingCost(tokenCount, provider.costPer1MTokens);
  return convertUsdToCredits(cost);
}

/** Optional helper for consistent log lines */
export function formatCostLog({
  tokens,
  costUsd,
  chargeUsd,
  profitUsd,
  credits,
  model,
  dims,
}: {
  tokens: number;
  costUsd: number;
  chargeUsd?: number;
  profitUsd?: number;
  credits?: number;
  model?: string;
  dims?: number;
}) {
  const parts = [
    tokens != null ? `tokens=${tokens}` : '',
    costUsd != null ? `cost=$${costUsd.toFixed(6)}` : '',
    chargeUsd != null ? `charge=$${chargeUsd.toFixed(6)}` : '',
    profitUsd != null ? `profit=$${profitUsd.toFixed(6)}` : '',
    credits != null ? `credits=${credits}` : '',
    model ? `model=${model}` : '',
    dims ? `dims=${dims}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}
