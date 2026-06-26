import { describe, it, expect } from "vitest";
import { projectValueSeries, projectChartSeries, generateLinePath } from "../value-series-projection";
import { buildPortfolioValueSeries } from "../../value-series";
import type { ValueSeriesTx } from "../../value-series";

describe("projectValueSeries", () => {
  const now = new Date("2026-06-25T12:00:00Z");

  it("projects a simple deposit series", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 1000, occurredAt: new Date("2026-01-01") },
    ];
    const points = projectValueSeries(txs, 1100, now);

    expect(points.length).toBeGreaterThanOrEqual(4);

    const lastPoint = points[points.length - 1]!;
    expect(lastPoint.value).toBe(1100);

    const firstPoint = points[0]!;
    expect(firstPoint.value).toBe(100);
  });

  it("handles distributions correctly", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 1000, occurredAt: new Date("2026-01-01") },
      { type: "distribution", amountUsdc: 50, occurredAt: new Date("2026-02-01") },
    ];
    const points = projectValueSeries(txs, 1050, now);

    const distPoint = points.find((p) => p.isDistribution);
    expect(distPoint).toBeDefined();
    expect(distPoint?.value).toBe(1100);
  });
});

describe("generateLinePath", () => {
  it("uses step-after interpolation when step option is set", () => {
    const points = [
      { x: 0, y: 100, value: 10, date: new Date() },
      { x: 50, y: 80, value: 12, date: new Date() },
      { x: 100, y: 60, value: 14, date: new Date() },
    ];
    const smooth = generateLinePath(points);
    const stepped = generateLinePath(points, { step: true });

    expect(smooth).toContain("L50.00,80.00");
    expect(stepped).toContain("L50.00,100.00");
    expect(stepped).toContain("L50.00,80.00");
  });
});

describe("projectChartSeries", () => {
  it("emits axis ticks for a non-empty series", () => {
    const now = new Date("2026-06-25T12:00:00Z");
    const built = buildPortfolioValueSeries({
      transactions: [{ type: "deposit", amountUsdc: 11, occurredAt: new Date("2026-06-01") }],
      totalValueUsdc: 11,
      now,
      range: "30d",
    });

    const projection = projectChartSeries(built.points, built.windowStart, built.windowEnd);
    expect(projection.points.length).toBeGreaterThan(1);
    expect(projection.xTicks.length).toBe(5);
    expect(projection.yTicks.length).toBe(2);
  });
});
