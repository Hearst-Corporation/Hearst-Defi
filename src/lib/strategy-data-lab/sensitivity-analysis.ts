/**
 * SensitivityAnalyzer — sweeps each variable from −rangeSteps to +rangeSteps and
 * measures the resulting ΔfinalROI and Δmin-liquidation-distance, ranking the
 * variables by ROI impact and by risk impact. Pure + deterministic.
 */

import {
  runManualStrategyProjection,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type Scenario,
} from "@/lib/scenario-runner";
import type {
  SensitivityConfig,
  SensitivityReport,
  SensitivityRow,
  SensitivityVariable,
} from "./types";

const BPS = 10_000;

export interface SensitivityRunConfig {
  scenario: Scenario;
  collateral: CollateralConfig;
  projection: ManualProjectionConfig;
  rules: RebalancingRule[];
  sensitivity: SensitivityConfig;
  seed?: number;
}

/** Apply `stepBps * step` to one variable. Pure. */
function withVariable(
  variable: SensitivityVariable,
  deltaBps: number,
  collateral: CollateralConfig,
  projection: ManualProjectionConfig,
): { collateral: CollateralConfig; projection: ManualProjectionConfig } {
  const c = { ...collateral };
  const p = { ...projection };
  switch (variable) {
    case "BTC_PRICE":
      p.btcPriceStart = Math.max(1, p.btcPriceStart * (1 + deltaBps / BPS));
      break;
    case "BTC_VOL":
      p.btcMonthlyVolBps = Math.max(0, p.btcMonthlyVolBps + deltaBps);
      break;
    case "BORROW_APR":
      c.borrowAprBps = Math.max(0, c.borrowAprBps + deltaBps);
      break;
    case "ELECTRICITY_COST":
      c.electricityMonthlyCostUsdc = Math.max(0, c.electricityMonthlyCostUsdc * (1 + deltaBps / BPS));
      break;
    case "STABLE_YIELD":
      p.stableYieldAprBps = Math.max(0, p.stableYieldAprBps + deltaBps);
      break;
    case "OVERLAY_YIELD":
      p.overlayYieldAprBps = Math.max(0, p.overlayYieldAprBps + deltaBps);
      break;
    case "LIQUIDATION_LTV":
      c.liquidationLtvBps = Math.min(BPS, Math.max(1, c.liquidationLtvBps + deltaBps));
      break;
  }
  return { collateral: c, projection: p };
}

export class SensitivityAnalyzer {
  run(config: SensitivityRunConfig): SensitivityReport {
    const { rangeSteps, stepBps } = config.sensitivity;
    const rules: RebalancingRule[] = config.rules.map((r) => ({ ...r, scenario: config.scenario }));

    const rows: SensitivityRow[] = config.sensitivity.variables.map((variable) => {
      const roiByStep: SensitivityRow["roiByStep"] = [];
      for (let step = -rangeSteps; step <= rangeSteps; step += 1) {
        const { collateral, projection } = withVariable(variable, step * stepBps, config.collateral, config.projection);
        const report = runManualStrategyProjection({
          scenario: config.scenario,
          collateral,
          projection,
          rules,
          seed: config.seed ?? 5,
        });
        roiByStep.push({
          step,
          finalRoiBps: report.finalRoiBps,
          minLiquidationDistanceBps: report.minLiquidationDistanceBps,
        });
      }
      const rois = roiByStep.map((s) => s.finalRoiBps);
      const dists = roiByStep.map((s) => s.minLiquidationDistanceBps);
      return {
        variable,
        roiByStep,
        roiImpactBps: Math.max(...rois) - Math.min(...rois),
        riskImpactBps: Math.max(...dists) - Math.min(...dists),
      };
    });

    const topRoiDrivers = [...rows].sort((a, b) => b.roiImpactBps - a.roiImpactBps).map((r) => r.variable);
    const topRiskDrivers = [...rows].sort((a, b) => b.riskImpactBps - a.riskImpactBps).map((r) => r.variable);

    return { rows, topRoiDrivers, topRiskDrivers };
  }
}
