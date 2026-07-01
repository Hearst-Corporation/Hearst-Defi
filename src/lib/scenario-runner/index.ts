/**
 * Scenario runner — public API. runManualStrategyProjection() is the single entry
 * point the admin UI + Product Workspace call to project a strategy over 24 months.
 */

export * from "./types";
export { ScenarioRunner, type ScenarioConfig } from "./scenario-runner";
export { ThresholdRuleEngine } from "./threshold-rule-engine";
export { gbmMarketModel, mulberry32 } from "./market-models";
export {
  BPS,
  ltvBps,
  liquidationDistanceBps,
  collateralValue,
  netEquity,
} from "./portfolio-math";
export {
  validateManualProjectionConfig,
  validateCollateralConfig,
  validateRuleSet,
  validateRebalancingRule,
  assertNoGuaranteedWording,
  type RunnerViolation,
} from "./validators";

import { ScenarioRunner } from "./scenario-runner";
import { ThresholdRuleEngine } from "./threshold-rule-engine";
import { gbmMarketModel } from "./market-models";
import type {
  CollateralConfig,
  ManualProjectionConfig,
  PortfolioState,
  RebalancingRule,
  Scenario,
  ScenarioReport,
} from "./types";

export interface ManualProjectionInput {
  scenario: Scenario;
  collateral: CollateralConfig;
  projection: ManualProjectionConfig;
  rules: RebalancingRule[];
  /** PRNG seed (default 1 for a smooth reproducible run). */
  seed?: number;
}

/**
 * Run a manual 24-month strategy projection. Deterministic — same input → same
 * report. Builds the initial portfolio state from the collateral config + the
 * projection's start price.
 */
export function runManualStrategyProjection(input: ManualProjectionInput): ScenarioReport {
  const initial: PortfolioState = {
    btcCollateral: input.collateral.initialBtcCollateral,
    debtUsdc: input.collateral.initialDebtUsdc,
    reserveUsdc: input.collateral.initialReserveUsdc ?? input.collateral.minReserveUsdc,
    btcPrice: input.projection.btcPriceStart,
  };
  const model = gbmMarketModel(
    input.projection.btcMonthlyDriftBps,
    input.projection.btcMonthlyVolBps,
    input.seed ?? 1,
  );
  const engine = new ThresholdRuleEngine(input.rules.filter((r) => r.scenario === input.scenario));
  const runner = new ScenarioRunner(
    { scenario: input.scenario, collateral: input.collateral, market: input.projection },
    model,
    engine,
  );
  return runner.run(initial);
}
