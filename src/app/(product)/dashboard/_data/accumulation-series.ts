// Builds accumulation chart series from BTC page production fixture shape.
// Dashboard uses the same fixture seam until GPU1 DTO is wired.

import type { AccumulationPoint } from "@/components/investor-widgets";

interface ProductionMonth {
  readonly period: string;
  readonly satsEarned: string;
  readonly cumulativeSatsEarned: string;
}

export function buildAccumulationSeries(
  monthly: readonly ProductionMonth[] | null | undefined,
  strategicRatio = 0.15,
): AccumulationPoint[] {
  if (!monthly?.length) return [];

  return monthly.map((m) => {
    const miningBtc = Number(m.cumulativeSatsEarned) / 1e8;
    const strategicBtc = miningBtc * strategicRatio;
    return {
      period: m.period,
      miningBtc,
      cumulativeBtc: miningBtc + strategicBtc,
    };
  });
}
