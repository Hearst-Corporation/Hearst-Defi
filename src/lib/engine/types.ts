export interface ScenarioInputs {
  btc_price_change_pct: number;
  hashprice_usd_th_day: number;
  energy_cost_kwh: number;
  stable_apy_pct: number;
  vol_index: number; // 0-100, BTC 30d volatility index
}

export type AllocationBucket =
  | "mining"
  | "btc_tactical"
  | "usdc_base"
  | "stable_reserve";

export interface Allocation {
  bucket: AllocationBucket;
  pct: number;
  yield_contribution_bps: number;
}

export type VaultMode = "defensive" | "balanced" | "opportunistic";

// First-class vault identity (ADR-006 lifts the single-vault MVP lock).
export type VaultId = "yield" | "defensive" | "btc-plus";

export type Confidence = "low" | "medium" | "high";

export interface ScenarioOutput {
  apy_range: { low: number; high: number };
  stressed_apy: number;
  risk_score: number;
  mining_margin_score: number;
  mode: VaultMode;
  allocations: Allocation[];
  assumptions: string[];
  confidence: Confidence;
  btc_tactical: BtcTacticalAssessment;
}

export type BtcTriggerKind = "accumulate" | "take_profit" | "reduce_size" | "hold";

export interface BtcTrigger {
  id: string;
  kind: BtcTriggerKind;
  condition: string;
  action: string;
  armed: boolean;
}

export type BtcGuardrailKind =
  | "volatility"
  | "mining_margin"
  | "concentration"
  | "liquidity";

export interface BtcGuardrail {
  id: string;
  kind: BtcGuardrailKind;
  label: string;
  status: "healthy" | "normal" | "warning" | "breached";
  detail: string;
}

export interface BtcTacticalAssessment {
  triggers: BtcTrigger[];
  guardrails: BtcGuardrail[];
  targetExposurePct: number;
}

export type Preset =
  | "base"
  | "btc_bear"
  | "btc_bull"
  | "mining_compression"
  | "extreme_stress";

export interface MiningRevenue {
  gross_revenue_usd_th_day: number;
  net_margin_usd_th_day: number;
  margin_score: number;
}

export type BacktestKey = "bear_2022" | "etf_halving_2024" | "mining_crunch_2024";

export interface ConstructionInputs {
  capacity_mw: number;
  infra_cost_usd_mw: number;
  asic_efficiency_j_th: number;
  asic_cost_usd_th: number;
  energy_cost_kwh: number;
  hashprice_usd_th_day: number;
}

export interface ConstructionOutput {
  total_capex_usd: number;
  infra_capex_usd: number;
  asic_capex_usd: number;
  yearly_opex_usd: number;
  yearly_revenue_usd: number;
  yearly_net_profit_usd: number;
  payback_months: number;
  roi_5y_pct: number;
  break_even_hashprice: number;
}

// ─── Scenario Engine v2 contract (ui-dev coding against this) ──────────────

export type ScenarioParams = {
  btcPriceUsd: number;
  networkHashrateEh: number;
  hashpricePer100Th: number;
  miningYieldPct: number;
  allocationWeights: {
    mining: number;
    btcTactical: number;
    usdcBase: number;
    stableReserve: number;
  };
  durationMonths: number;
  riskFreeRate: number;
};

export type MonthlyReturn = {
  month: number;
  nav: number;
  return: number;
  miningContrib: number;
  btcContrib: number;
  usdcContrib: number;
};

export type ScenarioResult = {
  params: ScenarioParams;
  monthly: MonthlyReturn[];
  apyLow: number;
  apyHigh: number;
  /**
   * NEVER LP-facing. Median of the empirical APY distribution kept only for
   * internal diagnostics (engine snapshot tests, scenario-vs-scenario delta).
   * Non-negotiable #1 forbids publishing any single-point APY: the headline is
   * always `{ apyLow, apyHigh }`. Do not serialize this to memos, statements,
   * agent JSON, or any LP-facing surface.
   */
  apyMedianInternal: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  var95: number;
  stressedApy: number;
  assumptions: string[];
  disclaimer: string;
};

export type ScenarioDelta = {
  /** Internal diagnostic only — see `ScenarioResult.apyMedianInternal`. */
  apyMedianInternal: number;
  maxDrawdown: number;
  sharpe: number;
  var95: number;
};

export interface MonthlyPoint {
  month: string;
  valueUsdc: number;
  distributionUsdc: number;
}

export interface BacktestOutput {
  key: BacktestKey;
  startDate: string;
  endDate: string;
  initialCapital: number;
  endingValue: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  worstMonthPct: number;
  numRebalances: number;
  monthlySeries: MonthlyPoint[];
  hearstRulesMode: boolean;
  assumptions: string[];
}

// NOTE: StatusVariant / BadgeVariant / Tone / PillTone sont des alias sémantiques
// qui devraient être unifiés dans une future refactor. Voir audit #3.
