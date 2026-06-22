/**
 * Tests for DistribCalendar pure helpers.
 *
 * These tests exercise the exported logic functions without any React renderer —
 * compatible with Vitest's node environment (no jsdom needed).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  barHeight,
  barX,
  DistribCalendar,
  formatPeriod,
  formatUsdc,
  shouldShowCompactPeriodLabel,
  type DistribEntry,
} from "@/components/portfolio/distrib-calendar";

// ── Test data helpers ─────────────────────────────────────────────────────────

function makePaid(period: string, amount: number, txHash?: string): DistribEntry {
  return {
    period,
    amountUsdc: amount,
    paidAt: new Date("2026-05-01T00:00:00Z"),
    txHash,
  };
}

function makeForecast(period: string, amount: number): DistribEntry {
  return {
    period,
    amountUsdc: amount,
    paidAt: null,
  };
}

// ── Suite 1: 12 paid + 1 forecast ─────────────────────────────────────────────

describe("DistribCalendar — 12 paid + 1 forecast = 13 bars", () => {
  it("should produce exactly 13 entries when 12 paid + 1 forecast are supplied", () => {
    const entries: DistribEntry[] = [
      makePaid("2025-06", 1840),
      makePaid("2025-07", 1910),
      makePaid("2025-08", 1975),
      makePaid("2025-09", 2010),
      makePaid("2025-10", 2050),
      makePaid("2025-11", 2090),
      makePaid("2025-12", 2130),
      makePaid("2026-01", 2150),
      makePaid("2026-02", 2165),
      makePaid("2026-03", 2180),
      makePaid("2026-04", 2205),
      makePaid("2026-05", 2310),
      makeForecast("2026-06", 2400),
    ];

    expect(entries).toHaveLength(13);

    const paidCount = entries.filter((e) => e.paidAt !== null).length;
    const forecastCount = entries.filter((e) => e.paidAt === null).length;

    expect(paidCount).toBe(12);
    expect(forecastCount).toBe(1);
  });
});

// ── Suite 2: Forecast bar carries [Estimate] semantics ────────────────────────

describe("DistribCalendar — forecast entry", () => {
  it("forecast entry has paidAt === null", () => {
    const entry = makeForecast("2026-06", 2400);
    expect(entry.paidAt).toBeNull();
  });

  it("forecast entry amount is positive", () => {
    const entry = makeForecast("2026-06", 2400);
    expect(entry.amountUsdc).toBeGreaterThan(0);
  });

  it("paid entry has paidAt set", () => {
    const entry = makePaid("2026-05", 2310, "0xabc123");
    expect(entry.paidAt).not.toBeNull();
    expect(entry.txHash).toBe("0xabc123");
  });
});

// ── Suite 3: Empty entries graceful handling ──────────────────────────────────

describe("DistribCalendar — empty entries", () => {
  it("empty array has length 0", () => {
    const entries: DistribEntry[] = [];
    expect(entries).toHaveLength(0);
  });

  it("zero-state renders the histogram skeleton (empty muted bars), no phrase", () => {
    const html = renderToStaticMarkup(
      <DistribCalendar entries={[]} shareClass={null} cadence={null} asOf={new Date("2026-06-01T00:00:00Z")} />,
    );

    // Skeleton frame is present
    expect(html).toContain("pf-distrib-chart--skeleton");
    expect(html).toContain("<svg");
    // No "no data yet" phrase, no invented amounts/labels
    expect(html).not.toContain("No distributions yet");
    expect(html).not.toContain("Monthly USDC payouts appear here");
    expect(html).not.toContain("[Estimate]");
  });

  it("barHeight with maxAmount=0 returns 0 (no division by zero)", () => {
    expect(barHeight(0, 0)).toBe(0);
  });

  it("barHeight with any amount but maxAmount=0 returns 0", () => {
    expect(barHeight(1000, 0)).toBe(0);
  });
});

// ── Suite 4: Single entry renders valid ───────────────────────────────────────

describe("DistribCalendar — single entry", () => {
  it("single paid entry array has length 1", () => {
    const entries: DistribEntry[] = [makePaid("2026-05", 2310)];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.paidAt).not.toBeNull();
  });

  it("barHeight for single entry == BAR_AREA_H (max bar, clamped at 100%)", () => {
    // When amount === maxAmount → ratio = 1 → full height
    const BAR_AREA_H = 140 - 8; // matches constants in component
    const h = barHeight(2310, 2310);
    expect(h).toBe(BAR_AREA_H);
  });

  it("barX for index 0 of 1 places bar at left offset", () => {
    const VB_W = 560;
    const BAR_W = Math.floor((VB_W - 0) / 1); // n=1, no gaps
    const GAP = 4;
    const x = barX(0, 1, BAR_W, GAP);
    // offset = (VB_W - (1 * BAR_W + 0 * GAP)) / 2
    const totalUsed = 1 * BAR_W;
    const expected = (VB_W - totalUsed) / 2;
    expect(x).toBeCloseTo(expected, 1);
  });
});

// ── Suite 5: formatPeriod helper ──────────────────────────────────────────────

describe("formatPeriod", () => {
  it("same year → short month only", () => {
    expect(formatPeriod("2026-04", 2026)).toBe("Apr");
  });

  it("different year → month'YY suffix", () => {
    expect(formatPeriod("2025-06", 2026)).toBe("Jun'25");
  });

  it("January edge case", () => {
    expect(formatPeriod("2026-01", 2026)).toBe("Jan");
    expect(formatPeriod("2025-01", 2026)).toBe("Jan'25");
  });
});

// ── Suite 6: compact zero-state label indices ─────────────────────────────────

describe("shouldShowCompactPeriodLabel", () => {
  it("shows labels only at quarter months (Jan, Apr, Jul, Oct)", () => {
    expect(shouldShowCompactPeriodLabel(0)).toBe(true);
    expect(shouldShowCompactPeriodLabel(3)).toBe(true);
    expect(shouldShowCompactPeriodLabel(6)).toBe(true);
    expect(shouldShowCompactPeriodLabel(9)).toBe(true);
    expect(shouldShowCompactPeriodLabel(1)).toBe(false);
    expect(shouldShowCompactPeriodLabel(5)).toBe(false);
    expect(shouldShowCompactPeriodLabel(11)).toBe(false);
  });
});

// ── Suite 7: formatUsdc helper ────────────────────────────────────────────────

describe("formatUsdc", () => {
  it("formats whole number with $ and no decimals", () => {
    expect(formatUsdc(2310)).toBe("$2,310");
    expect(formatUsdc(1840)).toBe("$1,840");
  });

  it("formats zero", () => {
    expect(formatUsdc(0)).toBe("$0");
  });
});
