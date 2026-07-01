/**
 * ForwardSimulationRunner — a controlled Monte Carlo: N SEEDED paths of the same
 * strategy, aggregated into percentiles + liquidation/repurchase probabilities.
 * Deterministic (each path's seed is derived from the base seed + index). A
 * conditional simulation — never a guarantee.
 */

import {
  runManualStrategyProjection,
  type RebalancingRule,
} from "@/lib/scenario-runner";
import { percentile } from "./metrics";
import type {
  ForwardSimulationConfig,
  ForwardSimulationReport,
  PathSummary,
} from "./types";

const BPS = 10_000;
/** Hard client-safety cap on paths (perf guard). */
export const MAX_PATHS = 500;

export class ForwardSimulationRunner {
  run(config: ForwardSimulationConfig): ForwardSimulationReport {
    const mc = config.monteCarlo;
    const paths = Math.max(1, Math.min(MAX_PATHS, Math.round(mc.paths)));
    const rules: RebalancingRule[] = config.rules.map((r) => ({ ...r, scenario: config.scenario }));

    const finalRois: number[] = [];
    const finalEquity: number[] = [];
    const summaries: PathSummary[] = [];
    let liquidations = 0;
    let repurchases = 0;
    let debtRepaidSum = 0;
    let btcSoldSum = 0;
    let btcBoughtSum = 0;

    // equityByMonth[m] collects the netEquityUsdc of every path at month m.
    // We allocate lazily after the first path sets the snapshot count.
    let equityByMonth: number[][] = [];

    for (let i = 0; i < paths; i += 1) {
      const seed = (mc.seed + i * 2654435761) >>> 0;
      const report = runManualStrategyProjection({
        scenario: config.scenario,
        collateral: config.collateral,
        projection: config.projection,
        rules,
        seed,
      });
      const last = report.snapshots[report.snapshots.length - 1]!;
      finalRois.push(report.finalRoiBps);
      finalEquity.push(last.netEquityUsdc);
      if (report.liquidationCount > 0) liquidations += 1;
      if (report.repurchaseCount > 0) repurchases += 1;
      debtRepaidSum += report.totalDebtRepaidUsdc;
      btcSoldSum += report.totalBtcSold;
      btcBoughtSum += report.totalBtcBought;
      summaries.push({
        seed,
        finalRoiBps: report.finalRoiBps,
        minLiquidationDistanceBps: report.minLiquidationDistanceBps,
        endedLiquidated: report.endedLiquidated,
      });

      // Capture monthly equity trajectory for band computation.
      if (i === 0) {
        // First path: initialise one slot per month.
        equityByMonth = report.snapshots.map(() => []);
      }
      for (let m = 0; m < report.snapshots.length; m += 1) {
        const slot = equityByMonth[m];
        if (slot !== undefined) {
          slot.push(report.snapshots[m]!.netEquityUsdc);
        }
      }
    }

    const bands = mc.confidenceBands.length ? mc.confidenceBands : [0.05, 0.5, 0.95];
    const roiPct: Record<string, number> = {};
    const eqPct: Record<string, number> = {};
    for (const q of bands) {
      const key = `p${Math.round(q * 100)}`;
      roiPct[key] = Math.round(percentile(finalRois, q));
      eqPct[key] = Math.round(percentile(finalEquity, q));
    }

    // Monthly equity bands: p5/p50/p95 at each month index.
    const monthlyEquityBands = equityByMonth.map((slot, m) => ({
      m,
      p5: Math.round(percentile(slot, 0.05)),
      p50: Math.round(percentile(slot, 0.5)),
      p95: Math.round(percentile(slot, 0.95)),
    }));

    // VaR (95% confidence): 5th-percentile of final ROIs (left tail).
    const var95RoiBps = Math.round(percentile(finalRois, 0.05));
    // CVaR / Expected Shortfall: mean of paths at or below VaR.
    const tailPaths = finalRois.filter((r) => r <= var95RoiBps);
    const cvar95RoiBps =
      tailPaths.length > 0
        ? Math.round(tailPaths.reduce((a, b) => a + b, 0) / tailPaths.length)
        : var95RoiBps;

    const sortedByRoi = [...summaries].sort((a, b) => a.finalRoiBps - b.finalRoiBps);
    const worstPath = sortedByRoi[0]!;
    const bestPath = sortedByRoi[sortedByRoi.length - 1]!;
    const medianPath = sortedByRoi[Math.floor(sortedByRoi.length / 2)]!;

    return {
      scenario: config.scenario,
      paths,
      finalRoiPercentilesBps: roiPct,
      finalEquityPercentilesUsdc: eqPct,
      liquidationProbabilityBps: Math.round((liquidations / paths) * BPS),
      repurchaseProbabilityBps: Math.round((repurchases / paths) * BPS),
      expectedDebtRepaidUsdc: Math.round(debtRepaidSum / paths),
      expectedBtcSold: Math.round((btcSoldSum / paths) * 1e4) / 1e4,
      expectedBtcBought: Math.round((btcBoughtSum / paths) * 1e4) / 1e4,
      worstPath,
      bestPath,
      medianPath,
      monthlyEquityBands,
      var95RoiBps,
      cvar95RoiBps,
    };
  }
}
