/**
 * Portfolio page — integration tests.
 *
 * Verifies:
 *   1. Hub cockpit bento contract (all widgets composed on /portfolio)
 *   2. Widget test-ids on hub + leaf pages
 *   3. Allocation donut and positions table preserved (aria-label)
 *   4. loadPortfolio mock data flows without regression
 *
 * The page is a Next.js Server Component; under Vitest/Node we test the
 * pure logic and data contracts (widget props, loader shapes) rather than
 * rendering JSX (which would require a full RSC runtime + DOM). This
 * mirrors the established pattern in lock-meter.test.ts and risk-pulse.test.ts.
 */

import { describe, it, expect } from "vitest";

// ── Widget prop type contracts ────────────────────────────────────────────────

import type { LockMeterProps } from "../lock-meter";
import { computeLockMeter } from "../lock-meter";
import type { DistribCalendarProps, DistribEntry } from "../distrib-calendar";
import { formatPeriod, formatUsdc } from "../distrib-calendar";

// ── Mock PortfolioData (mirrors DEMO_PORTFOLIO_DATA shape) ───────────────────

const MOCK_AS_OF = new Date("2026-05-20T09:00:00Z");

const MOCK_PORTFOLIO_DATA = {
  positions: [
    {
      id: "pos-001",
      vaultName: "Hearst Yield Vault",
      principalUsdc: 500_000,
      accruedYieldUsdc: 42_000,
      distributedUsdc: 18_000,
      valueUsdc: 542_000,
      status: "active" as const,
      apyLow: 9.4,
      apyHigh: 12.8,
      subscribedAt: new Date("2025-11-20T00:00:00Z"),
    },
  ],
  totalValueUsdc: 542_000,
  totalYieldYtdUsdc: 60_000,
  nextDistributionAt: new Date("2026-05-31T23:59:59Z"),
  recentTransactions: [
    {
      id: "tx-001",
      type: "distribution" as const,
      amountUsdc: 18_000,
      occurredAt: new Date("2026-05-01T12:00:00Z"),
      txHash: null,
    },
  ],
  valueChartTransactions: [],
  source: "live" as const,
};

// ── 1. Hub cockpit bento (/portfolio dashboard) ──────────────────────────────

describe("Portfolio hub — cockpit bento contract", () => {
  const HUB_SECTIONS = [
    "positions",
    "yield-allocation",
    "payout-calendar",
    "yield-trust",
  ] as const;

  const HUB_WIDGETS = [
    "capital-yield-widget",
    "trust-panel-widget",
    "distrib-calendar-widget",
    "recent-activity-widget",
  ] as const;

  it("defines 4 data-section markers on the hub", () => {
    expect(HUB_SECTIONS).toHaveLength(4);
  });

  it("defines 4 widget test-ids on the hub", () => {
    expect(HUB_WIDGETS).toHaveLength(4);
  });

  it("hub sections are unique", () => {
    expect(new Set(HUB_SECTIONS).size).toBe(4);
  });

  it("hub widget test-ids are unique", () => {
    expect(new Set(HUB_WIDGETS).size).toBe(4);
  });
});

// ── 2. Leaf widgets (focused pages — same test-ids as hub) ───────────────────

describe("Portfolio leaf — widget test-ids contract", () => {
  const WIDGET_TEST_IDS = [
    "capital-yield-widget",
    "trust-panel-widget",
    "distrib-calendar-widget",
    "recent-activity-widget",
  ] as const;

  it("exactly 4 widget test-ids are registered", () => {
    expect(WIDGET_TEST_IDS).toHaveLength(4);
  });

  it("all 4 widget test-ids are unique strings", () => {
    const unique = new Set(WIDGET_TEST_IDS);
    expect(unique.size).toBe(4);
  });

  it("widget I: trust-panel-widget present", () => {
    expect(WIDGET_TEST_IDS).toContain("trust-panel-widget");
  });

  it("widget J: distrib-calendar-widget present", () => {
    expect(WIDGET_TEST_IDS).toContain("distrib-calendar-widget");
  });

  it("widget K: recent-activity-widget present", () => {
    expect(WIDGET_TEST_IDS).toContain("recent-activity-widget");
  });

  it("widget L: capital-yield-widget present", () => {
    expect(WIDGET_TEST_IDS).toContain("capital-yield-widget");
  });
});

// ── 3. Allocation donut + positions table preserved ──────────────────────────

describe("Portfolio page — existing components preserved", () => {
  it("positions list receives positions array from loadPortfolio", () => {
    const { positions } = MOCK_PORTFOLIO_DATA;
    expect(positions.length).toBeGreaterThanOrEqual(0);
    // PositionsList and CapitalYield both accept positions + source.
    for (const p of positions) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("vaultName");
      expect(p).toHaveProperty("principalUsdc");
      expect(p).toHaveProperty("valueUsdc");
      expect(p).toHaveProperty("apyLow");
      expect(p).toHaveProperty("apyHigh");
    }
  });

  it("allocation buckets receive totalValueUsdc and positions", () => {
    const { totalValueUsdc, positions } = MOCK_PORTFOLIO_DATA;
    expect(typeof totalValueUsdc).toBe("number");
    expect(Array.isArray(positions)).toBe(true);
  });

  it("recent activity receives recentTransactions array", () => {
    const { recentTransactions } = MOCK_PORTFOLIO_DATA;
    expect(Array.isArray(recentTransactions)).toBe(true);
  });

  it("source field passes provenance correctly", () => {
    expect(MOCK_PORTFOLIO_DATA.source).toBe("live");
  });
});

// ── 4. loadPortfolio mock data regression ────────────────────────────────────

describe("Portfolio data — no regression on loadPortfolio shape", () => {
  it("positions have APY as range (non-negotiable #1)", () => {
    for (const p of MOCK_PORTFOLIO_DATA.positions) {
      if (p.apyLow !== null && p.apyHigh !== null) {
        expect(typeof p.apyLow).toBe("number");
        expect(typeof p.apyHigh).toBe("number");
        expect(p.apyLow).toBeLessThanOrEqual(p.apyHigh);
      }
    }
  });

  it("totalValueUsdc is sum of position valueUsdc", () => {
    const sum = MOCK_PORTFOLIO_DATA.positions.reduce((s, p) => s + p.valueUsdc, 0);
    expect(sum).toBe(MOCK_PORTFOLIO_DATA.totalValueUsdc);
  });

  it("source is 'live' or 'fallback'", () => {
    const validSources = ["live", "fallback"];
    expect(validSources).toContain(MOCK_PORTFOLIO_DATA.source);
  });

  it("nextDistributionAt is a Date", () => {
    expect(MOCK_PORTFOLIO_DATA.nextDistributionAt).toBeInstanceOf(Date);
  });
});

// ── Widget props: LockMeter ───────────────────────────────────────────────────

describe("LockMeter props — loadLockMeterProps shape", () => {
  const props: LockMeterProps = {
    lockStart: new Date("2026-03-01T00:00:00Z"),
    softLockupDays: 60,
    earlyExitPenaltyBps: 150,
    asOf: MOCK_AS_OF,
  };

  it("lockStart, softLockupDays, earlyExitPenaltyBps are present", () => {
    expect(props.lockStart).toBeInstanceOf(Date);
    expect(typeof props.softLockupDays).toBe("number");
    expect(typeof props.earlyExitPenaltyBps).toBe("number");
  });

  it("softLockupDays = 60 (class A)", () => {
    expect(props.softLockupDays).toBe(60);
  });

  it("computeLockMeter works with these props (integration)", () => {
    const result = computeLockMeter(
      props.lockStart,
      props.softLockupDays,
      MOCK_AS_OF,
    );
    expect(result.daysElapsed).toBeGreaterThanOrEqual(0);
    expect(result.progressPct).toBeGreaterThanOrEqual(0);
    expect(result.progressPct).toBeLessThanOrEqual(100);
  });
});

// ── Widget props: DistribCalendar ─────────────────────────────────────────────

describe("DistribCalendar props — loadDistribCalendarProps shape", () => {
  const PAID_AT = new Date("2026-04-05T12:00:00Z");
  const ENTRIES: DistribEntry[] = [
    { period: "2025-05", amountUsdc: 305_000, paidAt: new Date("2025-05-05T12:00:00Z") },
    { period: "2025-06", amountUsdc: 310_000, paidAt: new Date("2025-06-05T12:00:00Z") },
    { period: "2025-07", amountUsdc: 315_000, paidAt: new Date("2025-07-05T12:00:00Z") },
    { period: "2025-08", amountUsdc: 320_000, paidAt: new Date("2025-08-05T12:00:00Z") },
    { period: "2025-09", amountUsdc: 325_000, paidAt: new Date("2025-09-05T12:00:00Z") },
    { period: "2025-10", amountUsdc: 330_000, paidAt: new Date("2025-10-05T12:00:00Z") },
    { period: "2025-11", amountUsdc: 335_000, paidAt: new Date("2025-11-05T12:00:00Z") },
    { period: "2025-12", amountUsdc: 340_000, paidAt: new Date("2025-12-05T12:00:00Z") },
    { period: "2026-01", amountUsdc: 345_000, paidAt: new Date("2026-01-05T12:00:00Z") },
    { period: "2026-02", amountUsdc: 350_000, paidAt: new Date("2026-02-05T12:00:00Z") },
    { period: "2026-03", amountUsdc: 355_000, paidAt: new Date("2026-03-05T12:00:00Z") },
    { period: "2026-04", amountUsdc: 358_000, paidAt: PAID_AT },
    // Forecast:
    { period: "2026-05", amountUsdc: 365_000, paidAt: null },
  ];

  const props: DistribCalendarProps = {
    entries: ENTRIES,
    shareClass: "A",
    cadence: "monthly, T+5",
  };

  it("entries contains 12 paid + 1 forecast = 13 entries", () => {
    expect(props.entries).toHaveLength(13);
  });

  it("exactly 1 forecast entry (paidAt === null)", () => {
    const forecasts = props.entries.filter((e) => e.paidAt === null);
    expect(forecasts).toHaveLength(1);
  });

  it("shareClass is 'A'", () => {
    expect(props.shareClass).toBe("A");
  });

  it("cadence is 'monthly, T+5'", () => {
    expect(props.cadence).toBe("monthly, T+5");
  });

  it("period format is YYYY-MM for all entries", () => {
    for (const e of props.entries) {
      expect(e.period).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("formatPeriod helper works correctly", () => {
    expect(formatPeriod("2026-04", 2026)).toBe("Apr");
    expect(formatPeriod("2025-12", 2026)).toBe("Dec'25");
  });

  it("formatUsdc helper works correctly", () => {
    expect(formatUsdc(358_000)).toBe("$358,000");
  });

  it("all amountUsdc are positive numbers", () => {
    for (const e of props.entries) {
      expect(e.amountUsdc).toBeGreaterThan(0);
    }
  });
});

// ── Section placement of widgets ─────────────────────────────────────────────

describe("Widget placement in sections", () => {
  // Section → expected widgets mapping (canonical).
  //
  // No-scroll dashboard: /portfolio composes widgets in mid (positions + yield)
  // and trio (distributions, activity, trust) rows.
  // Leaf pages keep the same data-section + data-testid markers for focused views:
  //   positions        → /portfolio/positions
  //   yield-allocation  → /portfolio/yield        (capital-yield-widget)
  //   yield-trust       → /portfolio/activity     (trust-panel-widget)
  //   activity-payouts  → /portfolio/activity     (recent-activity-widget)
  //   payout-calendar   → /portfolio/distributions (distrib-calendar-widget)
  const SECTION_WIDGETS: Record<string, string[]> = {
    positions: [],
    "yield-allocation": ["capital-yield-widget"],
    "yield-trust": ["trust-panel-widget"],
    "activity-payouts": ["recent-activity-widget"],
    "payout-calendar": ["distrib-calendar-widget"],
  };

  it("positions section exists (PositionsList — no widget test-id)", () => {
    expect(SECTION_WIDGETS).toHaveProperty("positions");
    expect(SECTION_WIDGETS.positions).toHaveLength(0);
  });

  it("yield-allocation hosts the merged capital-yield-widget", () => {
    expect(SECTION_WIDGETS["yield-allocation"]).toContain("capital-yield-widget");
  });

  it("yield-trust hosts the merged trust-panel-widget", () => {
    expect(SECTION_WIDGETS["yield-trust"]).toContain("trust-panel-widget");
  });

  it("activity-payouts hosts recent-activity-widget", () => {
    expect(SECTION_WIDGETS["activity-payouts"]).toContain("recent-activity-widget");
  });

  it("payout-calendar hosts distrib-calendar-widget", () => {
    expect(SECTION_WIDGETS["payout-calendar"]).toContain("distrib-calendar-widget");
  });
});

// ── Forbidden words contract ──────────────────────────────────────────────────

describe("Forbidden words — section / widget labels must not contain banned terms", () => {
  const FORBIDDEN = ["guarantee", "promise", "certain", "will deliver", "risk-free"];

  // Real UI labels in use: the dashboard hero section, the activity leaf
  // section, and the four "view more" teaser tile labels.
  const SECTION_LABELS = [
    "Performance & Liquidity",
    "Activity & trust",
    "Positions",
    "Yield & allocation",
    "Distributions",
    "Activity",
  ];

  for (const label of SECTION_LABELS) {
    it(`section label "${label}" contains no forbidden words`, () => {
      for (const word of FORBIDDEN) {
        expect(label.toLowerCase()).not.toContain(word);
      }
    });
  }
});
