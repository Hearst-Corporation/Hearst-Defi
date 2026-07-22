// Pure tests for the shared accumulation series derivation:
// toMonthlyDeltas (cumulative points -> HONEST monthly production deltas).
//
// The buildAccumulationSeries block is gone with its function (2026-07-22
// purge): it applied a fixed +15% "strategic ratio" on top of real mining
// production — a manufactured total with no living caller.

import { describe, expect, it } from "vitest";

import {
  toMonthlyDeltas,
  type AccumulationPoint,
} from "@/features/investor-ui/charts/accumulation-series";

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
