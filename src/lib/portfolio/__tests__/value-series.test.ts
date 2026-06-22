import { describe, expect, it } from "vitest";

import {
  buildApyProjectionSeries,
  buildIndicativeValueSeries,
  buildPortfolioValueSeries,
} from "@/lib/portfolio/value-series";

describe("buildPortfolioValueSeries", () => {
  const asOf = new Date("2026-06-15T12:00:00.000Z");

  it("anchors terminal point to live mark", () => {
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 100_000,
          occurredAt: new Date("2026-01-10T00:00:00.000Z"),
        },
      ],
      110_000,
      asOf,
      12,
    );
    expect(series[series.length - 1]!.value).toBe(110_000);
  });

  it("window starts at the first deposit month — no invented pre-history", () => {
    // Deposit in Jan, asOf in Jun → 6 honest months (Jan…Jun), not 12 flat ones.
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 100_000,
          occurredAt: new Date("2026-01-10T00:00:00.000Z"),
        },
      ],
      110_000,
      asOf,
      12,
    );
    expect(series).toHaveLength(6);
    expect(series[0]!.label).toBe("Jan");
    expect(series[series.length - 1]!.label).toBe("Jun");
  });

  it("a brand-new deposit in asOf's month still yields ≥2 points (a line, not a dot)", () => {
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 250_000,
          occurredAt: new Date("2026-06-08T00:00:00.000Z"),
        },
      ],
      255_000,
      asOf,
      12,
    );
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series[series.length - 1]!.value).toBe(255_000);
  });

  it("caps the window at monthCount even when the first deposit is older", () => {
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 100_000,
          occurredAt: new Date("2024-01-10T00:00:00.000Z"),
        },
      ],
      110_000,
      asOf,
      12,
    );
    expect(series).toHaveLength(12);
  });

  it("flags months with distributions", () => {
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 100_000,
          occurredAt: new Date("2026-01-10T00:00:00.000Z"),
        },
        {
          type: "distribution",
          amountUsdc: 2_000,
          occurredAt: new Date("2026-04-05T12:00:00.000Z"),
        },
      ],
      105_000,
      asOf,
      12,
    );
    const aprilIdx = series.findIndex((p) => p.label === "Apr");
    expect(aprilIdx).toBeGreaterThanOrEqual(0);
    expect(series[aprilIdx]!.isDistribution).toBe(true);
  });

  it("does not apply a synthetic sine wave (monotonic toward deposit)", () => {
    const series = buildPortfolioValueSeries(
      [
        {
          type: "deposit",
          amountUsdc: 50_000,
          occurredAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
      60_000,
      asOf,
      12,
    );
    const postDeposit = series.filter((p) => p.value > 0);
    for (let i = 1; i < postDeposit.length; i++) {
      expect(postDeposit[i]!.value).toBeGreaterThanOrEqual(postDeposit[i - 1]!.value);
    }
  });
});

describe("buildIndicativeValueSeries", () => {
  it("linearly interpolates without oscillation", () => {
    const series = buildIndicativeValueSeries(
      100_000,
      120_000,
      new Date("2026-06-01T00:00:00.000Z"),
      5,
    );
    expect(series[0]!.value).toBe(100_000);
    expect(series[series.length - 1]!.value).toBe(120_000);
    expect(series[2]!.value).toBe(110_000);
  });

  it("never marks indicative points as distributions", () => {
    const series = buildIndicativeValueSeries(
      100_000,
      120_000,
      new Date("2026-06-01T00:00:00.000Z"),
      12,
    );
    expect(series.every((p) => !p.isDistribution)).toBe(true);
  });
});

describe("buildApyProjectionSeries", () => {
  const asOf = new Date("2026-06-15T12:00:00.000Z");

  it("returns 12 points for both low and high bands", () => {
    const { low, high } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    expect(low).toHaveLength(12);
    expect(high).toHaveLength(12);
  });

  it("first point equals baseUsdc for both bands", () => {
    const { low, high } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    expect(low[0]!.value).toBe(250_000);
    expect(high[0]!.value).toBe(250_000);
  });

  it("high band terminal value is greater than low band terminal value", () => {
    const { low, high } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    expect(high[11]!.value).toBeGreaterThan(low[11]!.value);
  });

  it("values are monotonically non-decreasing (compounded growth)", () => {
    const { low } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    for (let i = 1; i < low.length; i++) {
      expect(low[i]!.value).toBeGreaterThanOrEqual(low[i - 1]!.value);
    }
  });

  it("all points have isDistribution=false", () => {
    const { low, high } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    expect(low.every((p) => !p.isDistribution)).toBe(true);
    expect(high.every((p) => !p.isDistribution)).toBe(true);
  });

  it("returns correct month label for the terminal point", () => {
    const { low } = buildApyProjectionSeries(250_000, 9, 13, asOf, 12);
    // asOf = 2026-06-15, last month = Jun
    expect(low[11]!.label).toBe("Jun");
  });
});
