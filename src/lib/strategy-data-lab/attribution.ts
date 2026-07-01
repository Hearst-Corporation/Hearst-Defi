/**
 * Attribution — pure function that bridges start equity → end equity through
 * signed delta steps. Kept in a separate file so metrics.ts stays focused on
 * aggregate KPIs.
 *
 * Returns a LOCAL AttributionStep type (structurally identical to HcWaterfallStep)
 * so this lib module stays UI-free: no import of any component type.
 *
 * Pure: no I/O, no Math.random, no Date, no fetch.
 */

import type {
  CollateralConfig,
  ManualProjectionConfig,
  ScenarioReport,
} from "@/lib/scenario-runner";
import { BPS } from "@/lib/scenario-runner";

/** Mirrors HcWaterfallStep structurally — lib stays UI-free (no component import). */
export interface AttributionStep {
  label: string;
  value: number;
  kind: "delta" | "total";
}

/**
 * Compute signed attribution steps that explain start → end equity movement.
 *
 * Steps:
 *  1. "Start equity"        (total)  = snapshots[0].netEquityUsdc
 *  2. "+BTC appreciation"   (delta)  = Σ btcCollateral_{m-1} × (price_m − price_{m-1})
 *  3. "+Yield"              (delta)  = Σ reserveUsdc_{m-1} × monthlyYieldRate
 *  4. "−Electricity"        (delta)  = −(electricityMonthlyCostUsdc × months)
 *  5. "−Borrow interest"    (delta)  = −Σ debtUsdc_{m-1} × (borrowAprBps / 12 / BPS)
 *  6. "End equity"          (total)  = snapshots[last].netEquityUsdc
 *
 * The sum of deltas + start ≈ end (rounding tolerance accepted).
 */
export function computeAttribution(
  report: ScenarioReport,
  collateral: CollateralConfig,
  projection: ManualProjectionConfig,
): AttributionStep[] {
  const snaps = report.snapshots;
  if (snaps.length === 0) return [];

  const startEquity = snaps[0]!.netEquityUsdc;
  const endEquity = snaps[snaps.length - 1]!.netEquityUsdc;
  const months = snaps.length - 1;

  // BTC appreciation: Σ collateral_{m-1} × ΔpriceBtc_m
  let btcAppreciation = 0;
  for (let m = 1; m < snaps.length; m += 1) {
    const prev = snaps[m - 1]!;
    const curr = snaps[m]!;
    btcAppreciation += prev.btcCollateral * (curr.btcPrice - prev.btcPrice);
  }

  // Yield earned: same formula as metrics.ts
  const monthlyYieldRate =
    (projection.stableYieldAprBps +
      projection.overlayYieldAprBps +
      projection.miningYieldAprBps) /
    12 /
    BPS;
  let totalYield = 0;
  for (let m = 1; m < snaps.length; m += 1) {
    totalYield += Math.max(0, snaps[m - 1]!.reserveUsdc) * monthlyYieldRate;
  }

  // Electricity: fixed monthly cost × months
  const totalElectricity = collateral.electricityMonthlyCostUsdc * months;

  // Borrow interest: Σ debt_{m-1} × (borrowApr / 12 / BPS)
  const monthlyBorrowRate = collateral.borrowAprBps / 12 / BPS;
  let totalBorrow = 0;
  for (let m = 1; m < snaps.length; m += 1) {
    totalBorrow += snaps[m - 1]!.debtUsdc * monthlyBorrowRate;
  }

  return [
    { label: "Start equity", value: Math.round(startEquity), kind: "total" },
    { label: "+BTC appreciation", value: Math.round(btcAppreciation), kind: "delta" },
    { label: "+Yield", value: Math.round(totalYield), kind: "delta" },
    { label: "−Electricity", value: -Math.round(totalElectricity), kind: "delta" },
    { label: "−Borrow interest", value: -Math.round(totalBorrow), kind: "delta" },
    { label: "End equity", value: Math.round(endEquity), kind: "total" },
  ];
}
