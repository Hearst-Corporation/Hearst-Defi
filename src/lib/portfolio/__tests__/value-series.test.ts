import { describe, it, expect } from "vitest";
import {
  buildPortfolioValueSeries,
  chartWindowBounds,
  PORTFOLIO_VALUE_HOURLY_CADENCE_MS,
  type ValueSeriesTx,
} from "../value-series";

describe("buildPortfolioValueSeries", () => {
  const now = new Date("2026-06-25T12:00:00Z");

  it("reconstructs ledger steps for ALL range", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 1000, occurredAt: new Date("2026-01-01") },
    ];
    const built = buildPortfolioValueSeries({
      transactions: txs,
      totalValueUsdc: 1100,
      now,
      range: "all",
    });

    expect(built.mode).toBe("ledger_sparse");
    expect(built.points.length).toBeGreaterThanOrEqual(4);
    expect(built.points[built.points.length - 1]?.valueUsdc).toBe(1100);
    expect(built.points[0]?.valueUsdc).toBe(100);
  });

  it("uses hourly snapshots when provided", () => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      at: new Date(now.getTime() - (23 - i) * PORTFOLIO_VALUE_HOURLY_CADENCE_MS),
      valueUsdc: 10 + i * 0.01,
    }));

    const built = buildPortfolioValueSeries({
      transactions: [],
      totalValueUsdc: 10.23,
      now,
      range: "24h",
      hourlySnapshots: hourly,
    });

    expect(built.mode).toBe("hourly");
    expect(built.points.length).toBe(24);
    expect(built.densityNote).toContain("Hourly");
  });

  it("24h ledger fallback is honest when no events in window", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 11, occurredAt: new Date("2025-01-01") },
    ];
    const built = buildPortfolioValueSeries({
      transactions: txs,
      totalValueUsdc: 11,
      now,
      range: "24h",
    });

    expect(built.mode).toBe("ledger_sparse");
    expect(built.densityNote).toMatch(/hourly history pending|Live NAV/i);
    expect(built.points.length).toBe(2);
  });

  it("hourly feed filters to window and dedupes timestamps", () => {
    const hourly = [
      { at: new Date(now.getTime() - 25 * PORTFOLIO_VALUE_HOURLY_CADENCE_MS), valueUsdc: 9 },
      { at: new Date(now.getTime() - 20 * PORTFOLIO_VALUE_HOURLY_CADENCE_MS), valueUsdc: 10 },
      { at: new Date(now.getTime() - 20 * PORTFOLIO_VALUE_HOURLY_CADENCE_MS), valueUsdc: 10.5 },
      { at: new Date(now.getTime() - 10 * PORTFOLIO_VALUE_HOURLY_CADENCE_MS), valueUsdc: 10.9 },
    ];

    const built = buildPortfolioValueSeries({
      transactions: [],
      totalValueUsdc: 11,
      now,
      range: "24h",
      hourlySnapshots: hourly,
    });

    expect(built.mode).toBe("hourly");
    expect(built.densityNote).toBe("Hourly NAV prints");
    // Two distinct in-window prints after dedup (the two -20h collapse to one),
    // plus a flat carry-back point at windowStart so the line spans the window.
    expect(built.points[0]?.at.getTime()).toBe(now.getTime() - 24 * PORTFOLIO_VALUE_HOURLY_CADENCE_MS);
    expect(built.points.filter((p) => p.source === "hourly_snapshot")).toHaveLength(3);
    expect(built.points[built.points.length - 1]?.source).toBe("live_anchor");
    expect(built.points[built.points.length - 1]?.valueUsdc).toBe(11);
  });

  it("live anchor replaces last hourly print within half hour", () => {
    const hourly = [
      {
        at: new Date(now.getTime() - 15 * 60 * 1000),
        valueUsdc: 10.5,
      },
    ];

    const built = buildPortfolioValueSeries({
      transactions: [],
      totalValueUsdc: 11,
      now,
      range: "24h",
      hourlySnapshots: hourly,
    });

    // Flat carry-back anchors windowStart; the single recent print (<30min old)
    // is replaced in place by the live anchor at the current NAV.
    expect(built.points).toHaveLength(2);
    expect(built.points[0]?.at.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
    expect(built.points[built.points.length - 1]?.source).toBe("live_anchor");
    expect(built.points[built.points.length - 1]?.valueUsdc).toBe(11);
  });
});

describe("chartWindowBounds", () => {
  const now = new Date("2026-06-25T12:00:00Z");

  it("24h window spans exactly one day", () => {
    const { start, end } = chartWindowBounds(now, "24h");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
