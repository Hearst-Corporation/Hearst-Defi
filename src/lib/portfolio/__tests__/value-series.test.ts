import { describe, it, expect } from "vitest";
import {
  buildPortfolioValueSeries,
  chartWindowBounds,
  formatPortfolioCurrency,
  resolvePortfolioChartWindow,
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

describe("formatPortfolioCurrency", () => {
  it("handles whole dollars", () => {
    expect(formatPortfolioCurrency(0)).toBe("$0");
    expect(formatPortfolioCurrency(11)).toBe("$11");
    expect(formatPortfolioCurrency(999)).toBe("$999");
  });

  it("handles cents", () => {
    expect(formatPortfolioCurrency(11.2)).toBe("$11.20");
    expect(formatPortfolioCurrency(11.25)).toBe("$11.25");
  });

  it("handles thousands", () => {
    expect(formatPortfolioCurrency(11_200)).toBe("$11.2K");
    expect(formatPortfolioCurrency(1_000)).toBe("$1.0K");
  });

  it("handles millions", () => {
    expect(formatPortfolioCurrency(11_200_000)).toBe("$11.2M");
    expect(formatPortfolioCurrency(500_000)).toBe("$500.0K");
  });

  it("handles billions", () => {
    expect(formatPortfolioCurrency(1_120_000_000)).toBe("$1.1B");
  });

  it("handles negatives and non-finite", () => {
    expect(formatPortfolioCurrency(-11_200)).toBe("-$11.2K");
    expect(formatPortfolioCurrency(Number.NaN)).toBe("$0");
  });
});

describe("resolvePortfolioChartWindow", () => {
  const day = 24 * 60 * 60 * 1000;
  const mk = (offsets: number[], v: number) =>
    offsets.map((d) => ({ at: new Date(Date.UTC(2026, 0, 1) + d * day), value: v }));

  it("returns the empty state for <2 points", () => {
    const w = resolvePortfolioChartWindow([], "live");
    expect(w.granularity).toBe("empty");
    expect(w.xTicks).toHaveLength(0);
    expect(w.isLive).toBe(false);
    expect(w.subtitle).not.toContain("12 months");
  });

  it("uses daily labels + a 'last N days' subtitle for a short window", () => {
    const w = resolvePortfolioChartWindow(mk([0, 1, 2, 3], 100), "live");
    expect(w.granularity).toBe("daily");
    expect(w.subtitle).toContain("last 3 days");
    expect(w.subtitle).not.toContain("12 months");
    // Day-precise labels (e.g. "Jan 1"), not bare month names.
    expect(w.xTicks[0]?.label).toMatch(/[A-Z][a-z]{2} \d+/);
  });

  it("uses monthly labels + a trailing-months subtitle for a long window", () => {
    const w = resolvePortfolioChartWindow(mk([0, 120, 240, 364], 100), "live");
    expect(w.granularity).toBe("monthly");
    expect(w.subtitle).toContain("trailing 12 months");
    // Bare month names ("Jan"), no day number.
    expect(w.xTicks[0]?.label).toMatch(/^[A-Z][a-z]{2}$/);
  });

  it("never claims 12 months while the axis shows days (no mismatch)", () => {
    const w = resolvePortfolioChartWindow(mk([0, 1, 2, 3], 100), "live");
    const claims12m = w.subtitle.includes("12 months");
    const daysAxis = w.granularity === "daily";
    expect(claims12m && daysAxis).toBe(false);
  });

  it("marks fallback data as demo, never live", () => {
    const w = resolvePortfolioChartWindow(mk([0, 1, 2], 100), "fallback");
    expect(w.isDemo).toBe(true);
    expect(w.isLive).toBe(false);
  });

  it("flags a low / seed balance explicitly", () => {
    const seed = resolvePortfolioChartWindow(mk([0, 1, 2], 11), "live");
    expect(seed.isLowBalance).toBe(true);
    const mature = resolvePortfolioChartWindow(mk([0, 1, 2], 500_000), "live");
    expect(mature.isLowBalance).toBe(false);
  });

  it("emits at most 6 x-axis ticks", () => {
    const many = mk(Array.from({ length: 30 }, (_, i) => i), 100);
    const w = resolvePortfolioChartWindow(many, "live");
    expect(w.xTicks.length).toBeLessThanOrEqual(6);
    expect(w.xTicks.length).toBeGreaterThanOrEqual(2);
  });
});
