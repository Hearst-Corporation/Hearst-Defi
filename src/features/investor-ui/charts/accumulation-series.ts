// src/features/investor-ui/charts/accumulation-series.ts
//
// Shared presentation derivations for the BTC accumulation series.
//
// Trimmed 2026-07-22: this module used to also export
// `buildAccumulationSeries` (which inflated the real mining total by a fixed
// +15% "strategic ratio") and `withIllustrativePace` (a pace line with
// coefficients chosen to sit above the real curve). Neither had a living
// caller — their only consumers were components no route ever mounted — and
// both manufactured figures. They are gone; git holds them if a sourced need
// returns. What remains is the honest delta derivation the admin analytics
// gallery renders.

export interface AccumulationPoint {
  readonly period: string;
  /** Total BTC accumulated by the program up to this month (cumulative). */
  readonly cumulativeBtc: number;
  /** Mining-produced BTC up to this month (cumulative). */
  readonly miningBtc: number;
}

/** One month of REAL production, derived from consecutive cumulative points. */
export interface MonthlyDeltaPoint {
  readonly period: string;
  /** BTC produced by mining during this month only. */
  readonly miningBtc: number;
  /** Strategic BTC added during this month only. */
  readonly strategicBtc: number;
  /** Total BTC added during this month only. */
  readonly totalBtc: number;
}

/**
 * Cumulative points → honest month-over-month deltas. The first point's delta
 * is measured against 0 (program inception), and negatives are clamped at 0:
 * a cumulative series never decreases, so a negative delta means bad input,
 * rendered as 0 rather than a fabricated value.
 */
export function toMonthlyDeltas(points: readonly AccumulationPoint[]): MonthlyDeltaPoint[] {
  return points.map((p, i) => {
    const prev = i > 0 ? points[i - 1] : undefined;
    const miningBtc = Math.max(0, p.miningBtc - (prev?.miningBtc ?? 0));
    const totalBtc = Math.max(0, p.cumulativeBtc - (prev?.cumulativeBtc ?? 0));
    const strategicBtc = Math.max(0, totalBtc - miningBtc);
    return { period: p.period, miningBtc, strategicBtc, totalBtc };
  });
}
