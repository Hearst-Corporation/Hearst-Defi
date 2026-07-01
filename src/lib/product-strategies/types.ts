/**
 * Product strategy model — the structured, admin-defined definition that drives
 * Product Workspace projections. Replaces the ad-hoc "objective text → hardcoded
 * assumptions" path with a typed, selectable strategy carrying three risk
 * scenarios (Safe / Balanced / Opportunistic).
 *
 * Units: allocation + targets are in BASIS POINTS (bps, 1% = 100bps) so the
 * config carries no floating-point drift; volatility is a plain fraction.
 * Everything here is pure data — no I/O, no LLM.
 */

export type ProductFamily =
  | "btc_mining"
  | "stable_income"
  | "btc_upside"
  | "defi_yield"
  | "generic";

export type RiskProfileKey = "safe" | "balanced" | "opportunistic";

export type HorizonMonths = 12 | 24 | 36;

export type Priority =
  | "monthly_income"
  | "capital_protection"
  | "btc_upside"
  | "total_return"
  | "liquidity";

export type StrategyStatus = "draft" | "active" | "archived";

export interface ScenarioAllocation {
  miningBps: number;
  btcBps: number;
  stableReserveBps: number;
  yieldOverlayBps: number;
}

export interface ScenarioAssumptions {
  horizonMonths: HorizonMonths;
  /** BTC annualised vol (fraction). */
  btcAnnualVol: number;
  /** Multiplier applied to the base vol for this scenario. */
  volatilityMultiplier: number;
  distributionTargetLowBps?: number;
  distributionTargetHighBps?: number;
  totalPerformanceLowBps?: number;
  totalPerformanceHighBps?: number;
  /** Floor APY (bps) below which the scenario is not projected. */
  floorBps?: number;
}

export interface ScenarioConstraints {
  minMiningBps?: number;
  maxBtcBps?: number;
  minStableReserveBps?: number;
  maxYieldOverlayBps?: number;
}

export interface ProductStrategyScenario {
  label: "Safe" | "Balanced" | "Opportunistic";
  allocation: ScenarioAllocation;
  assumptions: ScenarioAssumptions;
  constraints: ScenarioConstraints;
  /** Short human bullets — no invented numbers, no guaranteed wording. */
  narrativeBullets: string[];
}

export interface StrategySelectionRules {
  keywords: string[];
  productFamilies: ProductFamily[];
  riskProfiles: RiskProfileKey[];
  priorities: Priority[];
  /** 0..1 — a request must clear this to match on note/keywords alone. */
  minConfidence: number;
}

export interface ProductStrategy {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: StrategyStatus;
  productFamily: ProductFamily;
  defaultRiskProfile: RiskProfileKey;
  defaultHorizonMonths: HorizonMonths;
  defaultPriority: Priority;
  selectionRules: StrategySelectionRules;
  scenarios: {
    safe: ProductStrategyScenario;
    balanced: ProductStrategyScenario;
    opportunistic: ProductStrategyScenario;
  };
  disclaimers: string[];
  /** True for the single generic fallback used when nothing else matches. */
  isFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface StrategySelectionRequest {
  productFamily?: ProductFamily | string;
  riskProfile?: RiskProfileKey | string;
  priority?: Priority | string;
  horizonMonths?: number;
  /** Liquidity / income / capital-protection preference hints (optional). */
  liquidityPreference?: "high" | "medium" | "low";
  incomePreference?: "monthly_distribution" | "growth" | "mixed";
  note?: string;
}

export interface StrategySelectionResult {
  strategy: ProductStrategy;
  score: number;
  matchedRules: string[];
  fallbackUsed: boolean;
}

export const RISK_LABEL: Record<RiskProfileKey, ProductStrategyScenario["label"]> = {
  safe: "Safe",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

export const PRODUCT_FAMILY_LABEL: Record<ProductFamily, string> = {
  btc_mining: "BTC Mining",
  stable_income: "Stable Income",
  btc_upside: "BTC Upside",
  defi_yield: "DeFi Yield",
  generic: "Generic",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  monthly_income: "Monthly income",
  capital_protection: "Capital protection",
  btc_upside: "BTC upside",
  total_return: "Total return",
  liquidity: "Liquidity",
};

/** Basis points → percent number (1250 → 12.5). */
export const bpsToPct = (bps: number): number => Math.round(bps) / 100;
