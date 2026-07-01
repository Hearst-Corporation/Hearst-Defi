/**
 * Strategy Data Lab — public API. A quant layer over the pure ScenarioRunner.
 */
export * from "./types";
export { computeMetrics, percentile } from "./metrics";
export { MARKET_REGIMES, getRegime } from "./regime-library";
export { SYNTHETIC_HISTORICAL_REGIMES } from "./fixtures";
export { BacktestRunner, applyRegime } from "./backtest-runner";
export { ForwardSimulationRunner, MAX_PATHS } from "./forward-simulation-runner";
export { StressMatrixRunner, type StressMatrixConfig } from "./stress-matrix";
export { SensitivityAnalyzer, type SensitivityRunConfig } from "./sensitivity-analysis";
export { analyzeTriggers } from "./trigger-analytics";
