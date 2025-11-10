// apps/backend/src/common/utils/profit-and-credits.ts
import { Prisma } from '@flopods/schema';
import { PROFIT_CONFIG } from '../config/profit.config';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Canonical billing/credits utilities
 * ──────────────────────────────────────────────────────────────────────────────
 * - Global markup is read from PROFIT_CONFIG (see ../config/profit.config)
 * - Credit value: $0.0001
 * - Credits = ceil(userCharge / 0.0001), MIN = 1, and >= any prior suggestion
 * - Robust Decimal coercion to avoid float issues & TS constructor complaints
 */

/** Robust coercion to Decimal (handles number | bigint | string | Decimal | obj.toString) */
export const D = (v: unknown): Prisma.Decimal => {
  if (v === null || v === undefined) return new Prisma.Decimal(0);

  if (v instanceof Prisma.Decimal) return v;

  const t = typeof v;

  if (t === 'number') {
    // Cast to any to satisfy Decimal constructor typing in @flopods/schema
    return new Prisma.Decimal(v as any);
  }

  if (t === 'bigint') {
    return new Prisma.Decimal((v as bigint).toString());
  }

  if (t === 'string') {
    const s = (v as string).trim();
    if (!s) return new Prisma.Decimal(0);
    try {
      return new Prisma.Decimal(s as any);
    } catch {
      return new Prisma.Decimal(0);
    }
  }

  try {
    const s = (v as any).toString?.();
    if (typeof s === 'string' && s && s !== '[object Object]') {
      return new Prisma.Decimal(s as any);
    }
  } catch {
    /* ignore */
  }

  return new Prisma.Decimal(0);
};

const MILLION = new Prisma.Decimal(1_000_000);
const EIGHT_DP = new Prisma.Decimal(100_000_000); // round display to 8dp
export const CREDIT_VALUE_USD = new Prisma.Decimal('0.0001');

const ceilDecimal = (x: Prisma.Decimal) => {
  const i = x.trunc();
  return x.eq(i) ? i : i.add(1);
};

export type TokenPricing = {
  inputTokenCost: Prisma.Decimal | string | number;
  outputTokenCost: Prisma.Decimal | string | number;
  reasoningTokenCost?: Prisma.Decimal | string | number;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
};

export type CostBreakdown = {
  inputCost: number; // rounded to 8dp for display
  outputCost: number; // rounded to 8dp for display
  reasoningCost: number; // rounded to 8dp for display
  totalCost: number; // rounded to 8dp for display
  totalCostDecimal: Prisma.Decimal; // exact Decimal (rounded to 8dp for billing)
  creditsCharged: number; // filled via settleCreditsCharge()
};

/** Calculate costs from token usage and per-million pricing */
export function calculateTokenCosts(
  usage: TokenUsage,
  pricingPerMillion: TokenPricing,
): CostBreakdown {
  // Rates (USD per 1M tokens)
  const inRatePM = D(pricingPerMillion.inputTokenCost);
  const outRatePM = D(pricingPerMillion.outputTokenCost);
  const reaRatePM = D(pricingPerMillion.reasoningTokenCost ?? 0);

  // Token counts
  const inTokens = D(usage.promptTokens || 0);
  const outTokens = D(usage.completionTokens || 0);
  const reaTokens = D(usage.reasoningTokens || 0);

  // Costs = (tokens / 1e6) * rate_per_million
  const inputCostDec = inTokens.div(MILLION).mul(inRatePM);
  const outputCostDec = outTokens.div(MILLION).mul(outRatePM);
  const reasoningCostDec = reaTokens.div(MILLION).mul(reaRatePM);
  const totalCostDec = inputCostDec.add(outputCostDec).add(reasoningCostDec);

  // Round to 8dp for billing display
  const r = (x: Prisma.Decimal) => x.mul(EIGHT_DP).round().div(EIGHT_DP);

  const inputCostRounded = r(inputCostDec);
  const outputCostRounded = r(outputCostDec);
  const reasoningCostRounded = r(reasoningCostDec);
  const totalCostRounded = r(totalCostDec);

  return {
    inputCost: Number(inputCostRounded.toString()),
    outputCost: Number(outputCostRounded.toString()),
    reasoningCost: Number(reasoningCostRounded.toString()),
    totalCost: Number(totalCostRounded.toString()),
    totalCostDecimal: totalCostRounded,
    creditsCharged: 0, // set later by settleCreditsCharge()
  };
}

/**
 * Apply global markup to an actual USD cost. Reads multiplier from PROFIT_CONFIG.
 * This is a small indirection to avoid circular imports (config imports this util).
 */
export function applyMarkup(actualCostUsd: number | Prisma.Decimal) {
  // Lazy import to avoid circular dep

  const actual = D(actualCostUsd);
  const mult = D(PROFIT_CONFIG.MARKUP_MULTIPLIER);
  const charge = actual.mul(mult);

  return {
    actualDecimal: actual,
    userChargeDecimal: charge,
    actual: Number(actual.toString()),
    userCharge: Number(charge.toString()),
  };
}

/** Credits from a user charge in USD: ceil(charge / $0.0001) with MIN = 1 */
export function creditsFromCharge(chargeUsd: number | Prisma.Decimal): number {
  const charge = D(chargeUsd);
  if (charge.lte(0)) return 0; // for completeness; final enforcement below
  const raw = ceilDecimal(charge.div(CREDIT_VALUE_USD));
  return Math.max(1, Number(raw.toString()));
}

/**
 * Finalize credits to subtract:
 *  - compute from userCharge,
 *  - enforce >= 1 if charge > 0,
 *  - ensure >= priorSuggested (if provided and > 0)
 */
export function settleCreditsCharge(args: {
  userChargeUsd: number | Prisma.Decimal;
  priorSuggestedCredits?: number; // optional legacy hint
}): number {
  const base = creditsFromCharge(args.userChargeUsd);
  const prior =
    typeof args.priorSuggestedCredits === 'number' && args.priorSuggestedCredits > 0
      ? Math.floor(args.priorSuggestedCredits)
      : 0;

  // if charge is zero or negative, but prior>0, still enforce MIN 1
  if (base <= 0 && prior > 0) return Math.max(1, prior);

  // normal case
  return Math.max(1, base, prior);
}

/** Pretty printer (cost) */
export function formatCostBreakdown(cost: CostBreakdown, tokens?: TokenUsage): string {
  const lines: string[] = [];
  if (tokens) {
    const inPerTok = tokens.promptTokens ? cost.inputCost / tokens.promptTokens : 0;
    const outPerTok = tokens.completionTokens ? cost.outputCost / tokens.completionTokens : 0;
    const reaPerTok =
      tokens.reasoningTokens && tokens.reasoningTokens > 0
        ? cost.reasoningCost / tokens.reasoningTokens
        : 0;

    lines.push(
      `    ├─ Input: ${tokens.promptTokens} tokens × $${inPerTok.toFixed(12)}/token = $${cost.inputCost.toFixed(8)}`,
    );
    lines.push(
      `    ├─ Output: ${tokens.completionTokens} tokens × $${outPerTok.toFixed(12)}/token = $${cost.outputCost.toFixed(8)}`,
    );
    if (tokens.reasoningTokens && tokens.reasoningTokens > 0 && cost.reasoningCost > 0) {
      lines.push(
        `    ├─ Reasoning: ${tokens.reasoningTokens} tokens × $${reaPerTok.toFixed(12)}/token = $${cost.reasoningCost.toFixed(8)}`,
      );
    }
  } else {
    lines.push(`    ├─ Input Cost: $${cost.inputCost.toFixed(8)}`);
    lines.push(`    ├─ Output Cost: $${cost.outputCost.toFixed(8)}`);
    if (cost.reasoningCost > 0)
      lines.push(`    ├─ Reasoning Cost: $${cost.reasoningCost.toFixed(8)}`);
  }
  lines.push(`    ├─ TOTAL COST: $${cost.totalCost.toFixed(8)}`);
  return lines.join('\n');
}

/**
 * Pretty printer (profit).
 * Backward-compatible:
 *  - new: formatProfitBreakdown({ actual, userCharge, profit, marginPct, roiPct, credits })
 *  - old: formatProfitBreakdown(actual, userCharge, profit, marginPct, roiPct, credits)
 */
export function formatProfitBreakdown(
  arg1:
    | {
        actual: number;
        userCharge: number;
        profit: number;
        marginPct: number;
        roiPct: number;
        credits: number;
      }
    | number,
  userCharge?: number,
  profit?: number,
  marginPct?: number,
  roiPct?: number,
  credits?: number,
): string {
  let actualL: number,
    userChargeL: number,
    profitL: number,
    marginL: number,
    roiL: number,
    creditsL: number;

  if (typeof arg1 === 'number') {
    actualL = arg1;
    userChargeL = userCharge ?? 0;
    profitL = profit ?? 0;
    marginL = marginPct ?? 0;
    roiL = roiPct ?? 0;
    creditsL = credits ?? 0;
  } else {
    actualL = arg1.actual;
    userChargeL = arg1.userCharge;
    profitL = arg1.profit;
    marginL = arg1.marginPct;
    roiL = arg1.roiPct;
    creditsL = arg1.credits;
  }

  return [
    `    ├─ ACTUAL COST: $${actualL.toFixed(8)}`,
    `    ├─ USER CHARGE: $${userChargeL.toFixed(8)}`,
    `    ├─ PROFIT: $${profitL.toFixed(8)} (${marginL.toFixed(2)}% margin)`,
    `    ├─ ROI: ${roiL.toFixed(2)}%`,
    `    └─ CREDITS CHARGED: ${creditsL}`,
  ].join('\n');
}
