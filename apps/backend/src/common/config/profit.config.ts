// apps/backend/src/common/config/profit.config.ts
/**
 * Global profit configuration.
 * Centralizes the markup multiplier and exposes legacy helpers for compatibility.
 */
import { D } from '../utils/profit-and-credits';

export const PROFIT_CONFIG = {
  // Default 8× unless overridden
  MARKUP_MULTIPLIER: parseFloat(process.env.PROFIT_MARKUP_MULTIPLIER || '8'),

  get profitMarginPercentage(): number {
    // (mult-1)/mult * 100
    return ((this.MARKUP_MULTIPLIER - 1) / this.MARKUP_MULTIPLIER) * 100;
  },

  get roi(): number {
    // (mult-1) * 100
    return (this.MARKUP_MULTIPLIER - 1) * 100;
  },
} as const;

/** Legacy helper kept for backward compatibility across services */
export function calculateProfitData(actualCostUsd: number): {
  actualCostUsd: number;
  userChargeUsd: number;
  profitUsd: number;
  profitMarginPercentage: number;
  roi: number;
} {
  const actual = D(actualCostUsd);
  const mult = D(PROFIT_CONFIG.MARKUP_MULTIPLIER);
  const charge = actual.mul(mult);
  const profit = charge.sub(actual);

  const userChargeUsd = Number(charge.toString());
  const profitUsd = Number(profit.toString());
  const marginPct = userChargeUsd > 0 ? (profitUsd / userChargeUsd) * 100 : 0;
  const roiPct = actualCostUsd > 0 ? (profitUsd / actualCostUsd) * 100 : 0;

  return {
    actualCostUsd: Number(actual.toString()),
    userChargeUsd,
    profitUsd,
    profitMarginPercentage: marginPct,
    roi: roiPct,
  };
}

/** Legacy helper kept for backward compatibility */
export function calculateCreditsFromCharge(chargeUsd: number): number {
  if (chargeUsd <= 0) return 0;
  const credits = Math.ceil(chargeUsd / 0.0001);
  return Math.max(1, credits);
}
