/**
 * Institutional metrics — pure. Computed from a ScenarioReport + its inputs.
 * "Sharpe-like" / "Sortino-like" are honestly named: no risk-free series, so
 * they are the mean/std (and mean/downside-dev) of monthly equity returns.
 */

import { BPS, type CollateralConfig, type ManualProjectionConfig, type ScenarioReport } from "@/lib/scenario-runner";
import type { DataLabMetrics } from "./types";

const round = (n: number) => Math.round(n);

export function computeMetrics(
  report: ScenarioReport,
  collateral: CollateralConfig,
  projection: ManualProjectionConfig,
): DataLabMetrics {
  const snaps = report.snapshots;
  const equity = snaps.map((s) => s.netEquityUsdc);
  const start = equity[0] ?? 0;
  const end = equity[equity.length - 1] ?? 0;
  const months = snaps.length - 1;

  // Monthly equity returns (fractions).
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i += 1) {
    const prev = equity[i - 1]!;
    returns.push(prev !== 0 ? (equity[i]! - prev) / Math.abs(prev) : 0);
  }
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length
    : 0;
  const std = Math.sqrt(variance);
  const downside = returns.filter((r) => r < 0);
  const downsideVar = downside.length ? downside.reduce((a, r) => a + r ** 2, 0) / downside.length : 0;
  const downsideDev = Math.sqrt(downsideVar);

  // Max drawdown of the equity curve (bps) + recovery months + underwater series.
  let peak = equity[0] ?? 0;
  let maxDd = 0;
  let troughIdx = 0;
  let peakAtTrough = peak;
  // Track the index at which peakAtTrough was reached (for duration calc).
  let peakAtTroughIdx = 0;
  const underwaterBps: number[] = [];
  equity.forEach((v, i) => {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    underwaterBps.push(Math.round(dd * BPS));
    if (dd > maxDd) {
      maxDd = dd;
      troughIdx = i;
      peakAtTrough = peak;
      // The peak-at-trough was the running peak just before this new max drawdown.
      // We approximate its index: walk back from troughIdx to find where equity hit peakAtTrough.
      peakAtTroughIdx = i;
      for (let k = i - 1; k >= 0; k -= 1) {
        if ((equity[k] ?? 0) >= peakAtTrough) {
          peakAtTroughIdx = k;
          break;
        }
      }
    }
  });
  // Months from the trough back to (or above) the pre-trough peak.
  let recoveryMonths = 0;
  let recoveryIdx = equity.length; // default: never recovered (use end)
  for (let i = troughIdx + 1; i < equity.length; i += 1) {
    if (equity[i]! >= peakAtTrough) {
      recoveryMonths = i - troughIdx;
      recoveryIdx = i;
      break;
    }
  }
  // Full peak→trough→recovery span (peak-at-trough to recovery; if never recovered, use end).
  const maxDrawdownDurationMonths = recoveryIdx - peakAtTroughIdx;

  const maxLtvBps = Math.max(0, ...snaps.map((s) => s.ltvBps));
  const monthsBelowBuffer = snaps.filter(
    (s) => s.liquidationDistanceBps < collateral.targetSafetyBufferBps,
  ).length;

  // Cost/earning aggregates (monthly, from the configured rates).
  const monthlyBorrow = collateral.borrowAprBps / 12 / BPS;
  let totalBorrow = 0;
  for (let i = 1; i < snaps.length; i += 1) totalBorrow += snaps[i - 1]!.debtUsdc * monthlyBorrow;
  const totalElectricity = collateral.electricityMonthlyCostUsdc * months;
  const monthlyYieldRate =
    (projection.stableYieldAprBps + projection.overlayYieldAprBps + projection.miningYieldAprBps) /
    12 /
    BPS;
  let totalYield = 0;
  for (let i = 1; i < snaps.length; i += 1) totalYield += Math.max(0, snaps[i - 1]!.reserveUsdc) * monthlyYieldRate;

  const netCashflow = totalYield - totalElectricity - totalBorrow;

  // Breakeven BTC price: the price at which final net equity == start equity,
  // holding the final collateral/debt/reserve. Approx from the final snapshot.
  const last = snaps[snaps.length - 1]!;
  const nonBtcEquity = last.reserveUsdc - last.debtUsdc;
  const breakeven = last.btcCollateral > 0 ? Math.max(0, (start - nonBtcEquity) / last.btcCollateral) : 0;

  // Wipeout fix: when the position ended liquidated, annualized ROI must floor at
  // -100% (−10 000 bps) — compounding a wipeout into a small finite negative is dishonest.
  const annualizedRoi =
    months > 0 && start !== 0
      ? report.endedLiquidated
        ? -1
        : Math.pow(Math.max(0.0001, end / start), 12 / months) - 1
      : 0;

  // Calmar-like: annualised ROI / max drawdown (fraction). Guard against zero maxDd.
  const calmarLike = maxDd > 0 ? Math.round((annualizedRoi / maxDd) * 100) / 100 : 0;

  // Tail ratio: |p95 return| / |p5 return| across monthly returns.
  const p95ret = Math.abs(percentile(returns, 0.95));
  const p5ret = Math.abs(percentile(returns, 0.05));
  const tailRatio = p5ret > 0 ? Math.round((p95ret / p5ret) * 100) / 100 : 0;

  return {
    finalRoiBps: report.finalRoiBps,
    annualizedRoiBps: report.endedLiquidated ? -10_000 : round(annualizedRoi * BPS),
    maxDrawdownBps: round(maxDd * BPS),
    maxLtvBps,
    minLiquidationDistanceBps: report.minLiquidationDistanceBps,
    monthsBelowSafetyBuffer: monthsBelowBuffer,
    liquidationEvents: report.liquidationCount,
    repurchaseEvents: report.repurchaseCount,
    totalBtcSold: report.totalBtcSold,
    totalBtcBought: report.totalBtcBought,
    totalDebtRepaidUsdc: report.totalDebtRepaidUsdc,
    totalElectricityCostUsdc: round(totalElectricity),
    totalBorrowCostUsdc: round(totalBorrow),
    totalYieldEarnedUsdc: round(totalYield),
    netCashflowUsdc: round(netCashflow),
    breakevenBtcPrice: round(breakeven),
    endedLiquidated: report.endedLiquidated,
    downsideDeviationBps: round(downsideDev * BPS),
    sharpeLike: std > 0 ? Math.round((mean / std) * 100) / 100 : 0,
    sortinoLike: downsideDev > 0 ? Math.round((mean / downsideDev) * 100) / 100 : 0,
    recoveryMonths,
    underwaterBps,
    calmarLike,
    maxDrawdownDurationMonths,
    tailRatio,
  };
}

/** Percentile of a numeric array (fraction q in [0,1]), linear interpolation. */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, q * (sorted.length - 1)));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}
