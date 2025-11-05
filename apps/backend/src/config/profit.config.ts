/**
 * Global Profit Configuration
 * Change PROFIT_MARKUP_MULTIPLIER in .env to adjust profit across ENTIRE project
 */

export const PROFIT_CONFIG = {
  // ✅ Read from .env or default to 2.0
  MARKUP_MULTIPLIER: parseFloat(process.env.PROFIT_MARKUP_MULTIPLIER || '2.0'),

  // ✅ Calculate derived values
  get profitMarginPercentage(): number {
    return ((this.MARKUP_MULTIPLIER - 1) / this.MARKUP_MULTIPLIER) * 100;
  },

  get roi(): number {
    return (this.MARKUP_MULTIPLIER - 1) * 100;
  },
} as const;

/**
 * Calculate profit from cost using global multiplier
 */
export function calculateProfitData(actualCostUsd: number): {
  actualCostUsd: number;
  userChargeUsd: number;
  profitUsd: number;
  profitMarginPercentage: number;
  roi: number;
} {
  // ✅ Remove the tiny cost guard - process everything
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

/**
 * Calculate cost for embeddings
 * Provider cost: $0.15 per 1M tokens
 */
export function calculateEmbeddingCost(totalTokens: number): number {
  const EMBEDDING_COST_PER_1M = 0.15;
  return (totalTokens / 1_000_000) * EMBEDDING_COST_PER_1M;
}

/**
 * Calculate credits from charge
 * 1 credit = $0.0001
 */
export function calculateCreditsFromCharge(chargeUsd: number): number {
  return Math.ceil(chargeUsd / 0.0001);
}
