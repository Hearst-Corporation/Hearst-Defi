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
