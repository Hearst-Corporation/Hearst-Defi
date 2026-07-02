/**
 * Strategy Data Lab — public API. A quant layer over the pure ScenarioRunner.
 */
export * from "./types";
export { computeMetrics, percentile } from "./metrics";
export { LAB_BASE_COLLATERAL, LAB_BASE_PROJECTION, LAB_BASE_RULES } from "./lab-defaults";
export { computeAttribution, type AttributionStep } from "./attribution";
export { MARKET_REGIMES, getRegime } from "./regime-library";
export { SYNTHETIC_HISTORICAL_REGIMES } from "./fixtures";
export { BacktestRunner, applyRegime } from "./backtest-runner";
export { ForwardSimulationRunner, MAX_PATHS } from "./forward-simulation-runner";
export { StressMatrixRunner, type StressMatrixConfig } from "./stress-matrix";
export { SensitivityAnalyzer, type SensitivityRunConfig } from "./sensitivity-analysis";
export { analyzeTriggers } from "./trigger-analytics";
export {
  recommendAllocation,
  derivePricePoints,
  deriveAssumptions,
  projectionForAllocation,
  collateralForAllocation,
  rescaleRulesToPrice,
  ALLOCATOR_MINING_FLOOR_BPS,
  ALLOCATOR_PATHS,
  ALLOCATOR_SEED,
  REF_WEIGHTS,
  type AllocationCandidate,
  type AllocatorInput,
  type StrategyPricePoint,
} from "./allocator";
export * from "./collateral-rebalancing";
