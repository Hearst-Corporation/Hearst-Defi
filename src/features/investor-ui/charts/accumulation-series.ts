// src/features/investor-ui/charts/accumulation-series.ts
//
// Shared presentation derivations for the BTC accumulation series (D7).
// Promoted from `src/app/(product)/dashboard/_data/accumulation-series.ts`
// so Dashboard + /btc + shared widgets consume ONE seam — the route copy
// stays until its consumers are re-pointed here.
//
// Presentation-only: converts the production fixture/DTO shape into chart
// points, and cumulative points into HONEST monthly deltas (the fixture
// exposes `cumulativeSatsEarned`; bars labelled "monthly" must show the
// month-over-month difference, never the raw cumulative).

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

interface ProductionMonth {
  readonly period: string;
  readonly satsEarned: string;
  readonly cumulativeSatsEarned: string;
}

/**
 * Fixture-only presentation derivation: the strategic sleeve is modelled as a
 * fixed ratio of mining production until the real DTO exposes it. Keep the
 * page-level provenance badge covering this simulation.
 */
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

/** An accumulation point enriched with the illustrative pace overlay. */
export interface PacedAccumulationPoint extends AccumulationPoint {
  /** Illustrative pace line — a fixture-derived overlay, never a target. */
  readonly pace: number;
}

/**
 * Fixture-only presentation derivation: enriches each point with an
 * illustrative pace value that trends clearly ABOVE the actual accumulation
 * toward term end. Pure view-model math — the ramp parameter `t` is computed
 * over the FULL series (t = i / (n - 1)), so window slices of the result keep
 * a stable pace shape (the line must not change form between time ranges).
 * Covered by the page-level simulated provenance badge.
 */
export function withIllustrativePace(
  points: readonly AccumulationPoint[],
): PacedAccumulationPoint[] {
  const n = points.length;
  return points.map((p, i) => ({
    ...p,
    pace: p.cumulativeBtc * (1.12 + 0.42 * (n > 1 ? i / (n - 1) : 0)),
  }));
}

/**
 * Converts cumulative accumulation points into real monthly production
 * deltas. First month's delta is its cumulative value (the series starts at
 * program inception); later months are the difference with the previous
 * month, clamped at 0 (a cumulative series never decreases — a negative
 * delta means bad input, rendered as 0 rather than a fabricated value).
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
