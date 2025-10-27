/**
 * Document Cost Calculator Utility
 *
 * @description Production-grade cost calculation for document processing.
 * Aligned with platform credit system (1 credit = $0.0001).
 * Uses Gemini text-embedding-004: $0.01 per 1M tokens.
 *
 * @module v1/documents/utils/cost-calculator
 */

import { GEMINI_EMBEDDING_PROVIDER } from '../types';
import type { DocumentEmbeddingProvider } from '../types';

/**
 * Platform credit configuration
 *
 * @constant
 * @description 1 credit = $0.0001 (10,000x multiplier)
 *
 * @example
 * - $1.25 = 12,500 credits (GPT-5 1M tokens)
 * - $0.01 = 100 credits (Gemini embedding 1M tokens)
 * - $0.001 = 10 credits (Gemini embedding 100K tokens)
 */
const CREDIT_VALUE = 0.0001;

/**
 * Calculate document embedding generation cost
 *
 * @description Calculates USD cost for generating embeddings.
 * Default: Gemini text-embedding-004 @ $0.01 per 1M tokens.
 *
 * @param tokenCount - Number of tokens to embed
 * @param provider - Embedding provider config (defaults to Gemini)
 * @returns Cost in USD (rounded to 8 decimal places)
 *
 * @throws {Error} If token count is negative
 *
 * @example
 * ```
 * // 50K tokens with Gemini
 * const cost = calculateDocumentEmbeddingCost(50_000);
 * console.log(cost); // 0.0005 USD
 *
 * // Calculation: (50,000 / 1,000,000) * $0.01 = $0.0005
 * ```
 */
export function calculateDocumentEmbeddingCost(
  tokenCount: number,
  provider: DocumentEmbeddingProvider = GEMINI_EMBEDDING_PROVIDER,
): number {
  if (tokenCount < 0) {
    throw new Error('Token count cannot be negative');
  }

  if (tokenCount === 0) {
    return 0;
  }

  // Calculate cost: (tokens / 1M) * cost_per_1M
  const totalCost = (tokenCount / 1_000_000) * provider.costPer1MTokens;

  // Round to 8 decimal places (matches Prisma Decimal(12, 8))
  return Math.round(totalCost * 100_000_000) / 100_000_000;
}

/**
 * Convert USD cost to platform credits
 *
 * @description Converts dollar cost to credits using 10,000x multiplier.
 * Formula: ceil(cost / 0.0001)
 * Rounds UP to ensure user always has enough credits.
 *
 * @param costInUsd - Cost in US dollars
 * @returns Number of credits (integer, rounded up)
 *
 * @throws {Error} If cost is negative
 *
 * @example
 * ```
 * // Example 1: Gemini embedding 100K tokens
 * const cost1 = 0.001; // $0.001
 * const credits1 = convertDocumentCostToCredits(cost1);
 * console.log(credits1); // 10 credits
 *
 * // Example 2: Gemini embedding 1M tokens
 * const cost2 = 0.01; // $0.01
 * const credits2 = convertDocumentCostToCredits(cost2);
 * console.log(credits2); // 100 credits
 *
 * // Example 3: Fractional credits (rounds up)
 * const cost3 = 0.00015; // $0.00015
 * const credits3 = convertDocumentCostToCredits(cost3);
 * console.log(credits3); // 2 credits (rounds up from 1.5)
 *
 * // Matches GPT-5 pricing:
 * const gpt5Cost = 1.25; // $1.25 per 1M tokens
 * const gpt5Credits = convertDocumentCostToCredits(gpt5Cost);
 * console.log(gpt5Credits); // 12,500 credits ✅
 * ```
 */
export function convertDocumentCostToCredits(costInUsd: number): number {
  if (costInUsd < 0) {
    throw new Error('Cost cannot be negative');
  }

  if (costInUsd === 0) {
    return 0;
  }

  // Convert to credits and round UP
  const credits = Math.ceil(costInUsd / CREDIT_VALUE);

  return credits;
}

/**
 * Estimate document processing cost
 *
 * @description Provides full cost breakdown for document processing.
 * - Extraction: $0 (free open-source: pdf-parse, tesseract, youtube-transcript)
 * - Embedding: Based on token count using Gemini
 * - Total: Sum of extraction + embedding
 * - Credits: Platform credits required
 *
 * @param tokenCount - Estimated token count
 * @param provider - Embedding provider (defaults to Gemini)
 * @returns Cost breakdown object
 *
 * @example
 * ```
 * // Estimate for 50K tokens
 * const estimate = estimateDocumentProcessingCost(50_000);
 * console.log(estimate);
 * // {
 * //   extractionCost: 0,           // Free
 * //   embeddingCost: 0.0005,       // $0.0005
 * //   totalCost: 0.0005,           // $0.0005
 * //   credits: 5                   // 5 credits
 * // }
 *
 * // Estimate for 1M tokens
 * const largeDocs = estimateDocumentProcessingCost(1_000_000);
 * console.log(largeDocs);
 * // {
 * //   extractionCost: 0,
 * //   embeddingCost: 0.01,         // $0.01
 * //   totalCost: 0.01,             // $0.01
 * //   credits: 100                 // 100 credits
 * // }
 * ```
 */
export function estimateDocumentProcessingCost(
  tokenCount: number,
  provider: DocumentEmbeddingProvider = GEMINI_EMBEDDING_PROVIDER,
): {
  extractionCost: number;
  embeddingCost: number;
  totalCost: number;
  credits: number;
} {
  // Text extraction is free (open-source libraries)
  const extractionCost = 0;

  // Calculate embedding cost
  const embeddingCost = calculateDocumentEmbeddingCost(tokenCount, provider);

  // Total cost
  const totalCost = extractionCost + embeddingCost;

  // Convert to credits
  const credits = convertDocumentCostToCredits(totalCost);

  return {
    extractionCost,
    embeddingCost,
    totalCost,
    credits,
  };
}

/**
 * Calculate credits for specific token amount
 *
 * @description Helper function to directly calculate credits from tokens.
 * Useful for quick credit checks before processing.
 *
 * @param tokenCount - Number of tokens
 * @returns Number of credits required
 *
 * @example
 * ```
 * const tokens = 250_000; // 250K tokens
 * const credits = calculateDocumentCreditsFromTokens(tokens);
 * console.log(credits); // 3 credits
 *
 * // Check if user has enough credits
 * if (subscription.credits < credits) {
 *   throw new Error('Insufficient credits');
 * }
 * ```
 */
export function calculateDocumentCreditsFromTokens(tokenCount: number): number {
  const cost = calculateDocumentEmbeddingCost(tokenCount);
  return convertDocumentCostToCredits(cost);
}
