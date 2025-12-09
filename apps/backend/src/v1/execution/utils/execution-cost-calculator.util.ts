// src/modules/v1/llm/utils/execution-cost-calculator.util.ts
import {
  calculateTokenCosts,
  formatCostBreakdown as formatCostBreakdownCommon,
  formatProfitBreakdown as formatProfitBreakdownCommon,
  applyMarkup,
  settleCreditsCharge,
  D,
  type CostBreakdown,
  type TokenUsage,
  type TokenPricing,
} from '../../../common/utils/profit-and-credits';

export {
  D,
  applyMarkup,
  settleCreditsCharge,
  formatCostBreakdownCommon as formatCostBreakdown,
  formatProfitBreakdownCommon as formatProfitBreakdown,
};
export type { CostBreakdown, TokenUsage, TokenPricing };

// Backwards-compatible name:
export function calculateLLMExecutionCost(
  tokenBreakdown: TokenUsage,
  pricingPerMillion: TokenPricing,
): CostBreakdown {
  return calculateTokenCosts(tokenBreakdown, pricingPerMillion);
}
