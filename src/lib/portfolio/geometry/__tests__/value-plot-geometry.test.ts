import { describe, expect, it } from "vitest";

import {
  buildPlotGeometry,
  ensureMinimumPlotPoints,
} from "../value-plot-geometry";
import type { ValueSeriesPoint } from "../../value-series";

describe("buildPlotGeometry", () => {
  const windowStart = new Date("2026-06-01T00:00:00Z");
  const windowEnd = new Date("2026-06-25T12:00:00Z");

  it("returns normalized coords and x labels for a multi-point series", () => {
    const points: ValueSeriesPoint[] = [
      { at: new Date("2026-06-01T00:00:00Z"), valueUsdc: 10, source: "ledger_step" },
      { at: new Date("2026-06-10T00:00:00Z"), valueUsdc: 12, source: "ledger_step" },
      { at: new Date("2026-06-20T00:00:00Z"), valueUsdc: 11, source: "ledger_step" },
    ];

    const geometry = buildPlotGeometry(points, windowStart, windowEnd);

    expect(geometry.coords).toHaveLength(3);
    expect(geometry.coords[0]!.x).toBe(0);
    expect(geometry.coords[2]!.x).toBeGreaterThan(geometry.coords[1]!.x);
    expect(geometry.xLabels).toHaveLength(4);
    expect(geometry.minValue).toBeLessThanOrEqual(10);
    expect(geometry.maxValue).toBeGreaterThanOrEqual(12);
  });

  it("pads a flat single-point series across the window", () => {
    const points: ValueSeriesPoint[] = [
      { at: new Date("2026-06-10T00:00:00Z"), valueUsdc: 250_000, source: "ledger_step" },
    ];

    const padded = ensureMinimumPlotPoints(points, windowStart, windowEnd);
    const geometry = buildPlotGeometry(padded, windowStart, windowEnd);

    expect(padded).toHaveLength(2);
    expect(geometry.coords).toHaveLength(2);
    expect(geometry.coords[0]!.y).toBeCloseTo(geometry.coords[1]!.y, 5);
  });
});
