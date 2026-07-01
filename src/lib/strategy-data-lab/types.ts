/**
 * Strategy Data Lab — types. A quant layer ON TOP of the pure ScenarioRunner
 * (src/lib/scenario-runner). The runner executes ONE 24-month trajectory; the
 * Data Lab orchestrates many (regimes × scenarios, N seeded paths, stress grids,
 * sensitivity sweeps) and aggregates institutional metrics. All deterministic,
 * no I/O, no LLM, no Math.random.
 */

import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
  Scenario,
  ScenarioReport,
} from "@/lib/scenario-runner";

export type DataLabMode =
  | "BACKTEST"
  | "FORWARD_SIMULATION"
  | "STRESS_MATRIX"
  | "SENSITIVITY"
  | "REGIME_COMPARISON";

/** A named, seeded market regime — a deterministic monthly BTC path shape. */
export interface MarketRegimeConfig {
  id: string;
  label: string;
  description: string;
  btcStartPrice: number;
  monthlyDriftBps: number;
  monthlyVolBps: number;
  /** Optional shocks (bps). Synthetic, labelled — not real historical data. */
  jumpRiskBps?: number;
  maxDrawdownShockBps?: number;
  recoveryDriftBps?: number;
  /** Overrides for the carrying economics under this regime. */
  borrowAprShockBps?: number;
  electricityShockBps?: number;
  yieldShockBps?: number;
}

export interface MonteCarloConfig {
  enabled: boolean;
  paths: number;
  seed: number;
  /** Confidence bands as fractions, e.g. [0.05, 0.5, 0.95]. */
  confidenceBands: number[];
  includeJumpRisk: boolean;
  includeElectricityShock: boolean;
  includeBorrowAprShock: boolean;
}

export interface StressGridConfig {
  btcShockBps: number[];
  borrowAprShockBps: number[];
  electricityShockBps: number[];
  yieldShockBps: number[];
}

export type SensitivityVariable =
  | "BTC_PRICE"
  | "BTC_VOL"
  | "BORROW_APR"
  | "ELECTRICITY_COST"
  | "STABLE_YIELD"
  | "OVERLAY_YIELD"
  | "LIQUIDATION_LTV";

export interface SensitivityConfig {
  variables: SensitivityVariable[];
  stepBps: number;
  rangeSteps: number;
}

// ---------------------------------------------------------------------------
// Institutional metrics (computed from a ScenarioReport)
// ---------------------------------------------------------------------------

export interface DataLabMetrics {
  finalRoiBps: number;
  annualizedRoiBps: number;
  maxDrawdownBps: number;
  maxLtvBps: number;
  minLiquidationDistanceBps: number;
  monthsBelowSafetyBuffer: number;
  liquidationEvents: number;
  repurchaseEvents: number;
  totalBtcSold: number;
  totalBtcBought: number;
  totalDebtRepaidUsdc: number;
  totalElectricityCostUsdc: number;
  totalBorrowCostUsdc: number;
  totalYieldEarnedUsdc: number;
  netCashflowUsdc: number;
  breakevenBtcPrice: number;
  endedLiquidated: boolean;
  /** Downside deviation of monthly equity returns (bps). */
  downsideDeviationBps: number;
  /** Sharpe-like = mean/std of monthly equity returns (rf = 0). Not a true Sharpe. */
  sharpeLike: number;
  /** Sortino-like = mean/downside-dev of monthly equity returns. */
  sortinoLike: number;
  /** Months from the max-drawdown trough back to the prior peak (0 = recovered instantly / never). */
  recoveryMonths: number;
  /** Running drawdown at each month in bps (length = snapshots.length). */
  underwaterBps: number[];
  /** Annualized ROI / maxDD — honest "Calmar-like" ratio (guard: 0 when maxDD = 0). */
  calmarLike: number;
  /** Full peak→trough→recovery span in months. */
  maxDrawdownDurationMonths: number;
  /** |p95 return| / |p5 return| — gain/pain tail ratio (0 when denominator is 0). */
  tailRatio: number;
}

// ---------------------------------------------------------------------------
// Shared run input — everything a Data Lab run needs to build a ScenarioRunner
// ---------------------------------------------------------------------------

export interface LabRunBase {
  collateral: CollateralConfig;
  projection: ManualProjectionConfig;
  rules: RebalancingRule[];
}

// ---------------------------------------------------------------------------
// Backtest
// ---------------------------------------------------------------------------

export interface BacktestConfig extends LabRunBase {
  strategyId: string;
  regimes: MarketRegimeConfig[];
  scenarios: Scenario[];
}

export interface BacktestRunResult {
  regimeId: string;
  regimeLabel: string;
  scenario: Scenario;
  report: ScenarioReport;
  metrics: DataLabMetrics;
}

export interface BacktestSummary {
  bestScenarioByRoi: Scenario;
  safestScenarioByMinDistance: Scenario;
  highestLiquidationRiskScenario: Scenario;
  averageFinalRoiBps: number;
  worstFinalRoiBps: number;
  bestFinalRoiBps: number;
  /** Share of runs (bps) that saw ≥1 liquidation / repurchase. */
  liquidationFrequencyBps: number;
  repurchaseFrequencyBps: number;
}

export interface BacktestReport {
  strategyId: string;
  runs: BacktestRunResult[];
  summary: BacktestSummary;
}

// ---------------------------------------------------------------------------
// Forward simulation (Monte Carlo)
// ---------------------------------------------------------------------------

export interface ForwardSimulationConfig extends LabRunBase {
  scenario: Scenario;
  monteCarlo: MonteCarloConfig;
}

export interface PathSummary {
  seed: number;
  finalRoiBps: number;
  minLiquidationDistanceBps: number;
  endedLiquidated: boolean;
}

export interface ForwardSimulationReport {
  scenario: Scenario;
  paths: number;
  /** Base seed used for this simulation run (for display / audit trail). */
  seed: number;
  /** Percentile → final ROI bps (keys from confidenceBands). */
  finalRoiPercentilesBps: Record<string, number>;
  finalEquityPercentilesUsdc: Record<string, number>;
  liquidationProbabilityBps: number;
  repurchaseProbabilityBps: number;
  expectedDebtRepaidUsdc: number;
  expectedBtcSold: number;
  expectedBtcBought: number;
  worstPath: PathSummary;
  bestPath: PathSummary;
  medianPath: PathSummary;
  /** Monthly equity percentile bands across all paths. Length = durationMonths + 1. */
  monthlyEquityBands: { m: number; p5: number; p50: number; p95: number }[];
  /** 5th-percentile final ROI in bps (Value at Risk, 95% confidence). */
  var95RoiBps: number;
  /** Expected Shortfall: mean of paths whose final ROI ≤ var95RoiBps. */
  cvar95RoiBps: number;
}

// ---------------------------------------------------------------------------
// Stress matrix
// ---------------------------------------------------------------------------

export interface StressAxis {
  variable: "BTC_SHOCK" | "BORROW_APR_SHOCK" | "ELECTRICITY_SHOCK" | "YIELD_SHOCK";
  values: number[];
}

export type StressRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface StressMatrixCell {
  x: number;
  y: number;
  finalRoiBps: number;
  minLiquidationDistanceBps: number;
  liquidationEvents: number;
  endedLiquidated: boolean;
  riskLevel: StressRiskLevel;
}

export interface StressMatrixReport {
  xAxis: StressAxis;
  yAxis: StressAxis;
  cells: StressMatrixCell[];
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

export interface SensitivityRow {
  variable: SensitivityVariable;
  /** Signed steps (…−2,−1,0,+1,+2…) → final ROI bps. */
  roiByStep: { step: number; finalRoiBps: number; minLiquidationDistanceBps: number }[];
  /** |ΔROI| across the swept range (bps) — the ROI impact magnitude. */
  roiImpactBps: number;
  /** |Δmin-distance| across the range (bps) — the risk impact magnitude. */
  riskImpactBps: number;
}

export interface SensitivityReport {
  rows: SensitivityRow[];
  topRoiDrivers: SensitivityVariable[];
  topRiskDrivers: SensitivityVariable[];
}

// ---------------------------------------------------------------------------
// Trigger analytics
// ---------------------------------------------------------------------------

export interface TriggerAnalyticsReport {
  mostFrequentTriggerRuleId: string | null;
  costliestByBtcRuleId: string | null;
  mostDebtSavedRuleId: string | null;
  firstLiquidationMonth: number | null;
  firstRepurchaseMonth: number | null;
  liquidationCount: number;
  repurchaseCount: number;
  /** e.g. "liquidation → recovery → repurchase" when the pattern is present. */
  typicalSequence: string;
}
