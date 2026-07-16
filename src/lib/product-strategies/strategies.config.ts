/**
 * Product strategy config — the seeded, admin-visible strategy library. Typed,
 * versionable data (no DB write yet; the admin editor works on local state +
 * preview, and the pipeline reads these). Every strategy here passes
 * validateStrategySet (asserted in tests). Fixed timestamps keep the module
 * pure (no Date.now at import time).
 *
 * bps: 1% = 100bps. Each scenario's 4 sleeves sum to 10_000.
 *
 * v2 note (BTC Mining Performance): the product is a mining NOTE that accumulates
 * BTC over the term with rule-based take-profit — there is NO periodic cash
 * distribution. The `distributionTargetLowBps` / `distributionTargetHighBps`
 * fields (legacy names, kept for consumers) carry the estimated take-profit /
 * accumulation target band, not a cash payout rate.
 */

import type { ProductStrategy, ProductStrategyScenario } from "./types";

const T0 = "2026-07-01T00:00:00.000Z";

const NOT_GUARANTEED =
  "Projections are conditional on the stated assumptions and are not guaranteed.";

// --- BTC Mining -----------------------------------------------------------

const miningSafe: ProductStrategyScenario = {
  label: "Safe",
  allocation: { miningBps: 3000, btcBps: 1500, stableReserveBps: 2500, yieldOverlayBps: 3000 },
  assumptions: {
    horizonMonths: 24,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 0.9,
    distributionTargetLowBps: 600,
    distributionTargetHighBps: 900,
    totalPerformanceLowBps: 700,
    totalPerformanceHighBps: 1100,
    floorBps: 800,
  },
  constraints: { minMiningBps: 3000, maxBtcBps: 2000, minStableReserveBps: 2000 },
  narrativeBullets: [
    "Mining floored at 30% with the largest stable reserve of the three.",
    "Lower BTC exposure to dampen drawdowns.",
  ],
};

const miningBalanced: ProductStrategyScenario = {
  label: "Balanced",
  allocation: { miningBps: 3400, btcBps: 2600, stableReserveBps: 1200, yieldOverlayBps: 2800 },
  assumptions: {
    horizonMonths: 24,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 1.0,
    distributionTargetLowBps: 700,
    distributionTargetHighBps: 1100,
    totalPerformanceLowBps: 900,
    totalPerformanceHighBps: 1500,
    floorBps: 800,
  },
  constraints: { minMiningBps: 3000, maxBtcBps: 3500 },
  narrativeBullets: [
    "Balanced mining/BTC blend — the recommended default.",
    "Rule-based take-profit converts gains into accumulated BTC over the term.",
  ],
};

const miningOpportunistic: ProductStrategyScenario = {
  label: "Opportunistic",
  allocation: { miningBps: 3400, btcBps: 3400, stableReserveBps: 800, yieldOverlayBps: 2400 },
  assumptions: {
    horizonMonths: 24,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 1.15,
    distributionTargetLowBps: 700,
    distributionTargetHighBps: 1200,
    totalPerformanceLowBps: 1000,
    totalPerformanceHighBps: 2000,
    floorBps: 800,
  },
  constraints: { minMiningBps: 3000, maxBtcBps: 3500 },
  narrativeBullets: [
    "Highest BTC exposure for upside, smallest stable reserve.",
    "Wider dispersion — larger drawdown risk in bear regimes.",
  ],
};

// --- Stable Income --------------------------------------------------------

const stableSafe: ProductStrategyScenario = {
  label: "Safe",
  allocation: { miningBps: 0, btcBps: 500, stableReserveBps: 5500, yieldOverlayBps: 4000 },
  assumptions: {
    horizonMonths: 12,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 0.8,
    distributionTargetLowBps: 500,
    distributionTargetHighBps: 800,
    totalPerformanceLowBps: 500,
    totalPerformanceHighBps: 800,
    floorBps: 400,
  },
  constraints: { maxBtcBps: 1000, minStableReserveBps: 4000 },
  narrativeBullets: [
    "Capital-protection first: majority in the stable reserve.",
    "Yield overlay targets an estimated income range, subject to the stated assumptions — not a fixed or promised payout.",
  ],
};

const stableBalanced: ProductStrategyScenario = {
  label: "Balanced",
  allocation: { miningBps: 0, btcBps: 1500, stableReserveBps: 4000, yieldOverlayBps: 4500 },
  assumptions: {
    horizonMonths: 12,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 0.9,
    distributionTargetLowBps: 600,
    distributionTargetHighBps: 900,
    totalPerformanceLowBps: 600,
    totalPerformanceHighBps: 1000,
    floorBps: 400,
  },
  constraints: { maxBtcBps: 2500 },
  narrativeBullets: [
    "A touch of BTC for total-return upside on top of income.",
    "Yield overlay remains the income engine.",
  ],
};

const stableOpportunistic: ProductStrategyScenario = {
  label: "Opportunistic",
  allocation: { miningBps: 0, btcBps: 2500, stableReserveBps: 3000, yieldOverlayBps: 4500 },
  assumptions: {
    horizonMonths: 12,
    btcAnnualVol: 0.6,
    volatilityMultiplier: 1.0,
    distributionTargetLowBps: 600,
    distributionTargetHighBps: 900,
    totalPerformanceLowBps: 700,
    totalPerformanceHighBps: 1300,
    floorBps: 400,
  },
  constraints: { maxBtcBps: 3000 },
  narrativeBullets: [
    "Higher BTC sleeve for more total-return participation.",
    "Still income-oriented — the overlay stays the largest sleeve.",
  ],
};

// --- Generic (fallback) ---------------------------------------------------

const genericSafe: ProductStrategyScenario = {
  label: "Safe",
  allocation: { miningBps: 1500, btcBps: 1500, stableReserveBps: 3500, yieldOverlayBps: 3500 },
  assumptions: { horizonMonths: 24, btcAnnualVol: 0.6, volatilityMultiplier: 0.9, floorBps: 600 },
  constraints: {},
  narrativeBullets: ["Conservative default blend.", "Largest stable reserve of the three."],
};

const genericBalanced: ProductStrategyScenario = {
  label: "Balanced",
  allocation: { miningBps: 2000, btcBps: 2500, stableReserveBps: 2500, yieldOverlayBps: 3000 },
  assumptions: { horizonMonths: 24, btcAnnualVol: 0.6, volatilityMultiplier: 1.0, floorBps: 600 },
  constraints: {},
  narrativeBullets: ["Balanced default blend — the fallback recommendation."],
};

const genericOpportunistic: ProductStrategyScenario = {
  label: "Opportunistic",
  allocation: { miningBps: 2000, btcBps: 3500, stableReserveBps: 1500, yieldOverlayBps: 3000 },
  assumptions: { horizonMonths: 24, btcAnnualVol: 0.6, volatilityMultiplier: 1.15, floorBps: 600 },
  constraints: {},
  narrativeBullets: ["Higher BTC exposure default.", "Smaller stable reserve."],
};

export const PRODUCT_STRATEGIES: ProductStrategy[] = [
  {
    id: "strat-btc-mining-performance",
    slug: "btc-mining-performance",
    name: "BTC Mining Performance",
    description:
      "Mining-backed BTC accumulation note with a 30% mining floor and a BTC-holding sleeve for upside. Rule-based take-profit accumulates BTC over a ~24-month term; no periodic cash distribution.",
    status: "active",
    productFamily: "btc_mining",
    defaultRiskProfile: "balanced",
    defaultHorizonMonths: 24,
    defaultPriority: "total_return",
    selectionRules: {
      keywords: ["mining", "miner", "asic", "hashrate", "hashprice"],
      productFamilies: ["btc_mining"],
      riskProfiles: ["safe", "balanced", "opportunistic"],
      priorities: ["total_return", "btc_upside", "monthly_income"],
      minConfidence: 0.25,
    },
    scenarios: { safe: miningSafe, balanced: miningBalanced, opportunistic: miningOpportunistic },
    disclaimers: [NOT_GUARANTEED, "Mainnet deploy stays gated on a completed audit."],
    isFallback: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "strat-stable-income",
    slug: "stable-income",
    name: "Stable USDC Income",
    description:
      "Capital-protection-first income product: a large stable reserve plus a yield overlay targeting an estimated income range under the stated assumptions — not a fixed or promised payout.",
    status: "active",
    productFamily: "stable_income",
    defaultRiskProfile: "safe",
    defaultHorizonMonths: 12,
    defaultPriority: "monthly_income",
    selectionRules: {
      keywords: ["stable", "usdc", "income", "monthly", "conservative", "capital preservation"],
      productFamilies: ["stable_income", "defi_yield"],
      riskProfiles: ["safe", "balanced"],
      priorities: ["monthly_income", "capital_protection", "liquidity"],
      minConfidence: 0.25,
    },
    scenarios: { safe: stableSafe, balanced: stableBalanced, opportunistic: stableOpportunistic },
    disclaimers: [NOT_GUARANTEED],
    isFallback: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: "strat-generic-balanced",
    slug: "generic-balanced",
    name: "Generic Balanced",
    description: "The default fallback used when no specific strategy matches the request.",
    status: "active",
    productFamily: "generic",
    defaultRiskProfile: "balanced",
    defaultHorizonMonths: 24,
    defaultPriority: "total_return",
    selectionRules: {
      keywords: [],
      productFamilies: ["generic"],
      riskProfiles: ["safe", "balanced", "opportunistic"],
      priorities: ["total_return"],
      minConfidence: 0,
    },
    scenarios: { safe: genericSafe, balanced: genericBalanced, opportunistic: genericOpportunistic },
    disclaimers: [NOT_GUARANTEED],
    isFallback: true,
    createdAt: T0,
    updatedAt: T0,
  },
];

/** The single active fallback strategy. */
export function getFallbackStrategy(strategies: ProductStrategy[] = PRODUCT_STRATEGIES): ProductStrategy {
  const fb = strategies.find((s) => s.isFallback && s.status === "active");
  // The config always contains exactly one; the non-null path is validated.
  return fb ?? strategies[strategies.length - 1]!;
}
