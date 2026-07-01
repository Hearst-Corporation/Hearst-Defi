/**
 * StressMatrixRunner — a 2-D grid of stress shocks. Each cell re-runs the pure
 * ScenarioRunner with the shocks applied and classifies a risk level. MVP axes:
 * BTC shock × electricity shock; the types support borrow/yield/LTV axes too.
 */

import {
  runManualStrategyProjection,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type Scenario,
} from "@/lib/scenario-runner";
import type {
  StressAxis,
  StressMatrixCell,
  StressMatrixReport,
  StressRiskLevel,
} from "./types";

const BPS = 10_000;

export interface StressMatrixConfig {
  scenario: Scenario;
  collateral: CollateralConfig;
  projection: ManualProjectionConfig;
  rules: RebalancingRule[];
  xAxis: StressAxis;
  yAxis: StressAxis;
  seed?: number;
}

/** Apply a single axis shock to the config. Pure. */
function applyShock(
  variable: StressAxis["variable"],
  shockBps: number,
  collateral: CollateralConfig,
  projection: ManualProjectionConfig,
): { collateral: CollateralConfig; projection: ManualProjectionConfig } {
  const c = { ...collateral };
  const p = { ...projection };
  switch (variable) {
    case "BTC_SHOCK":
      // A one-off shock to the starting price (a fraction, bps).
      p.btcPriceStart = Math.max(1, p.btcPriceStart * (1 + shockBps / BPS));
      break;
    case "BORROW_APR_SHOCK":
      c.borrowAprBps = Math.max(0, c.borrowAprBps + shockBps);
      break;
    case "ELECTRICITY_SHOCK":
      c.electricityMonthlyCostUsdc = Math.max(0, c.electricityMonthlyCostUsdc * (1 + shockBps / BPS));
      break;
    case "YIELD_SHOCK": {
      const f = 1 + shockBps / BPS;
      p.stableYieldAprBps = Math.max(0, p.stableYieldAprBps * f);
      p.overlayYieldAprBps = Math.max(0, p.overlayYieldAprBps * f);
      p.miningYieldAprBps = Math.max(0, p.miningYieldAprBps * f);
      break;
    }
  }
  return { collateral: c, projection: p };
}

function classify(cell: Omit<StressMatrixCell, "riskLevel">): StressRiskLevel {
  if (cell.endedLiquidated || cell.minLiquidationDistanceBps <= 0) return "CRITICAL";
  if (cell.liquidationEvents > 0 || cell.minLiquidationDistanceBps < 1000) return "HIGH";
  if (cell.finalRoiBps < 0 || cell.minLiquidationDistanceBps < 2500) return "MEDIUM";
  return "LOW";
}

export class StressMatrixRunner {
  run(config: StressMatrixConfig): StressMatrixReport {
    const cells: StressMatrixCell[] = [];
    const rules: RebalancingRule[] = config.rules.map((r) => ({ ...r, scenario: config.scenario }));

    for (const y of config.yAxis.values) {
      const withY = applyShock(config.yAxis.variable, y, config.collateral, config.projection);
      for (const x of config.xAxis.values) {
        const withX = applyShock(config.xAxis.variable, x, withY.collateral, withY.projection);
        const report = runManualStrategyProjection({
          scenario: config.scenario,
          collateral: withX.collateral,
          projection: withX.projection,
          rules,
          seed: config.seed ?? 11,
        });
        const partial = {
          x,
          y,
          finalRoiBps: report.finalRoiBps,
          minLiquidationDistanceBps: report.minLiquidationDistanceBps,
          liquidationEvents: report.liquidationCount,
          endedLiquidated: report.endedLiquidated,
        };
        cells.push({ ...partial, riskLevel: classify(partial) });
      }
    }

    return { xAxis: config.xAxis, yAxis: config.yAxis, cells };
  }
}
