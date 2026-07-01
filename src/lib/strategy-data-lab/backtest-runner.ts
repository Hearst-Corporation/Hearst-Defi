/**
 * BacktestRunner — orchestrates the pure ScenarioRunner across regimes × scenarios.
 * Deterministic. Each regime maps to a seeded market path + optional economic
 * shocks (borrow / electricity / yield) applied to the base config.
 */

import {
  runManualStrategyProjection,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type Scenario,
} from "@/lib/scenario-runner";
import { computeMetrics } from "./metrics";
import type {
  BacktestConfig,
  BacktestReport,
  BacktestRunResult,
  BacktestSummary,
  MarketRegimeConfig,
} from "./types";

const BPS = 10_000;

/** Apply a regime's shocks to the base collateral + projection. Pure. */
export function applyRegime(
  regime: MarketRegimeConfig,
  collateral: CollateralConfig,
  projection: ManualProjectionConfig,
): { collateral: CollateralConfig; projection: ManualProjectionConfig } {
  const nextCollateral: CollateralConfig = {
    ...collateral,
    borrowAprBps: Math.max(0, collateral.borrowAprBps + (regime.borrowAprShockBps ?? 0)),
    electricityMonthlyCostUsdc:
      collateral.electricityMonthlyCostUsdc *
      (1 + (regime.electricityShockBps ?? 0) / BPS),
  };
  const yieldFactor = 1 + (regime.yieldShockBps ?? 0) / BPS;
  const nextProjection: ManualProjectionConfig = {
    ...projection,
    btcPriceStart: regime.btcStartPrice,
    btcMonthlyDriftBps: regime.monthlyDriftBps,
    btcMonthlyVolBps: regime.monthlyVolBps,
    stableYieldAprBps: Math.max(0, projection.stableYieldAprBps * yieldFactor),
    overlayYieldAprBps: Math.max(0, projection.overlayYieldAprBps * yieldFactor),
    miningYieldAprBps: Math.max(0, projection.miningYieldAprBps * yieldFactor),
  };
  return { collateral: nextCollateral, projection: nextProjection };
}

/** Stable per-(regime,scenario) seed so a backtest is fully reproducible. */
function seedFor(regimeId: string, scenario: Scenario): number {
  let h = 2166136261 >>> 0;
  const s = `${regimeId}|${scenario}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class BacktestRunner {
  run(config: BacktestConfig): BacktestReport {
    const runs: BacktestRunResult[] = [];

    for (const regime of config.regimes) {
      const { collateral, projection } = applyRegime(regime, config.collateral, config.projection);
      for (const scenario of config.scenarios) {
        const rules: RebalancingRule[] = config.rules.map((r) => ({ ...r, scenario }));
        const report = runManualStrategyProjection({
          scenario,
          collateral,
          projection,
          rules,
          seed: seedFor(regime.id, scenario),
        });
        runs.push({
          regimeId: regime.id,
          regimeLabel: regime.label,
          scenario,
          report,
          metrics: computeMetrics(report, collateral, projection),
        });
      }
    }

    return { strategyId: config.strategyId, runs, summary: summarize(runs, config.scenarios) };
  }
}

function summarize(runs: BacktestRunResult[], scenarios: Scenario[]): BacktestSummary {
  const rois = runs.map((r) => r.report.finalRoiBps);
  const avg = rois.length ? Math.round(rois.reduce((a, b) => a + b, 0) / rois.length) : 0;

  // Per-scenario aggregates.
  const byScenario = (fn: (r: BacktestRunResult) => number, pick: "max" | "min") => {
    let best: Scenario = scenarios[0] ?? "balanced";
    let bestVal = pick === "max" ? -Infinity : Infinity;
    for (const sc of scenarios) {
      const vals = runs.filter((r) => r.scenario === sc).map(fn);
      const agg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      if ((pick === "max" && agg > bestVal) || (pick === "min" && agg < bestVal)) {
        bestVal = agg;
        best = sc;
      }
    }
    return best;
  };

  const liqRuns = runs.filter((r) => r.report.liquidationCount > 0).length;
  const repRuns = runs.filter((r) => r.report.repurchaseCount > 0).length;

  return {
    bestScenarioByRoi: byScenario((r) => r.report.finalRoiBps, "max"),
    safestScenarioByMinDistance: byScenario((r) => r.report.minLiquidationDistanceBps, "max"),
    highestLiquidationRiskScenario: byScenario((r) => r.report.liquidationCount, "max"),
    averageFinalRoiBps: avg,
    worstFinalRoiBps: rois.length ? Math.min(...rois) : 0,
    bestFinalRoiBps: rois.length ? Math.max(...rois) : 0,
    liquidationFrequencyBps: runs.length ? Math.round((liqRuns / runs.length) * BPS) : 0,
    repurchaseFrequencyBps: runs.length ? Math.round((repRuns / runs.length) * BPS) : 0,
  };
}
