// Pure tests for the shared accumulation series derivations (D7):
// buildAccumulationSeries (fixture shape -> chart points) and toMonthlyDeltas
// (cumulative points -> HONEST monthly production deltas).

import { describe, expect, it } from "vitest";

import {
  buildAccumulationSeries,
  toMonthlyDeltas,
  type AccumulationPoint,
} from "@/features/investor-ui/charts/accumulation-series";

describe("buildAccumulationSeries", () => {
  it("returns [] for null/undefined/empty input", () => {
    expect(buildAccumulationSeries(null)).toEqual([]);
    expect(buildAccumulationSeries(undefined)).toEqual([]);
    expect(buildAccumulationSeries([])).toEqual([]);
  });

  it("converts cumulative sats to BTC and applies the strategic ratio", () => {
    const points = buildAccumulationSeries([
      { period: "2026-01", satsEarned: "100000000", cumulativeSatsEarned: "100000000" },
      { period: "2026-02", satsEarned: "100000000", cumulativeSatsEarned: "200000000" },
    ]);
    expect(points).toHaveLength(2);
    expect(points[0]?.miningBtc).toBeCloseTo(1, 8);
    expect(points[0]?.cumulativeBtc).toBeCloseTo(1.15, 8);
    expect(points[1]?.miningBtc).toBeCloseTo(2, 8);
    expect(points[1]?.cumulativeBtc).toBeCloseTo(2.3, 8);
  });

  it("strategicRatio 0 makes total equal mining-produced", () => {
    const points = buildAccumulationSeries(
      [{ period: "2026-01", satsEarned: "1", cumulativeSatsEarned: "50000000" }],
      0,
    );
    expect(points[0]?.cumulativeBtc).toBeCloseTo(points[0]?.miningBtc ?? Number.NaN, 8);
  });
});

describe("toMonthlyDeltas", () => {
  const points: readonly AccumulationPoint[] = [
    { period: "2026-01", miningBtc: 0.412, cumulativeBtc: 0.4738 },
    { period: "2026-02", miningBtc: 0.86, cumulativeBtc: 0.989 },
    { period: "2026-03", miningBtc: 1.331, cumulativeBtc: 1.53065 },
  ];

  it("first month's delta is its own cumulative value", () => {
    const deltas = toMonthlyDeltas(points);
    expect(deltas[0]?.miningBtc).toBeCloseTo(0.412, 8);
    expect(deltas[0]?.totalBtc).toBeCloseTo(0.4738, 8);
    expect(deltas[0]?.strategicBtc).toBeCloseTo(0.0618, 8);
  });

  it("later months are month-over-month differences, never cumulative", () => {
    const deltas = toMonthlyDeltas(points);
    expect(deltas[1]?.miningBtc).toBeCloseTo(0.448, 8);
    expect(deltas[1]?.totalBtc).toBeCloseTo(0.5152, 8);
    expect(deltas[2]?.miningBtc).toBeCloseTo(0.471, 8);
    // Sum of deltas reconstructs the final cumulative — nothing invented.
    const sum = deltas.reduce((acc, d) => acc + d.totalBtc, 0);
    expect(sum).toBeCloseTo(points[2]?.cumulativeBtc ?? Number.NaN, 8);
  });

  it("keeps periods aligned with the input", () => {
    const deltas = toMonthlyDeltas(points);
    expect(deltas.map((d) => d.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("clamps a (bad) decreasing cumulative at 0 instead of fabricating a negative bar", () => {
    const deltas = toMonthlyDeltas([
      { period: "2026-01", miningBtc: 2, cumulativeBtc: 2.3 },
      { period: "2026-02", miningBtc: 1, cumulativeBtc: 1.15 },
    ]);
    expect(deltas[1]?.miningBtc).toBe(0);
    expect(deltas[1]?.totalBtc).toBe(0);
    expect(deltas[1]?.strategicBtc).toBe(0);
  });

  it("returns [] for an empty series", () => {
    expect(toMonthlyDeltas([])).toEqual([]);
  });
});
