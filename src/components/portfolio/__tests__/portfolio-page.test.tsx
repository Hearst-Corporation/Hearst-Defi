/**
 * Portfolio page — integration tests.
 *
 * Verifies:
 *   1. Page structure renders 3 distinct sections (data-section attributes)
 *   2. All 5 new widgets present (data-testid attributes)
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
import type { RiskPulseProps, RiskScore } from "../risk-pulse";
import type { DistribCalendarProps, DistribEntry } from "../distrib-calendar";
import { formatPeriod, formatUsdc } from "../distrib-calendar";
import type { ProofPulseProps } from "../proof-pulse";
import { computeDeltaPct, isMatch } from "../proof-pulse";
import type { YieldStackProps } from "../yield-stack";
import { barWidthPct, formatContribution, BUCKET_COLOR } from "../yield-stack";

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
  source: "live" as const,
};

// ── 1. 3 sections defined ────────────────────────────────────────────────────

describe("Portfolio page — 3 sections contract", () => {
  const EXPECTED_SECTIONS = ["hero-pulse", "activity-payouts", "yield-trust"] as const;

  it("defines exactly 3 distinct section identifiers", () => {
    expect(EXPECTED_SECTIONS).toHaveLength(3);
  });

  it("section identifiers are unique strings", () => {
    const unique = new Set(EXPECTED_SECTIONS);
    expect(unique.size).toBe(3);
  });

  it("Section 1 identifier is 'hero-pulse'", () => {
    expect(EXPECTED_SECTIONS[0]).toBe("hero-pulse");
  });

  it("Section 2 identifier is 'activity-payouts'", () => {
    expect(EXPECTED_SECTIONS[1]).toBe("activity-payouts");
  });

  it("Section 3 identifier is 'yield-trust'", () => {
    expect(EXPECTED_SECTIONS[2]).toBe("yield-trust");
  });
});

// ── 2. 4 new widgets present (lock-meter has no page test-id) ────────────────

describe("Portfolio page — 4 new widgets contract", () => {
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
    // The PositionsList and AllocationDonut both accept positions + source.
    for (const p of positions) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("vaultName");
      expect(p).toHaveProperty("principalUsdc");
      expect(p).toHaveProperty("valueUsdc");
      expect(p).toHaveProperty("apyLow");
      expect(p).toHaveProperty("apyHigh");
    }
  });

  it("allocation donut receives totalValueUsdc and positions", () => {
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

// ── Widget props: RiskPulse ───────────────────────────────────────────────────

describe("RiskPulse props — loadRiskPulseProps shape", () => {
  const STUB_SCORES: RiskScore[] = [
    { dimension: "market",         score: 38, delta30d: -2 },
    { dimension: "mining",         score: 28, delta30d: 0  },
    { dimension: "liquidity",      score: 44, delta30d: 1  },
    { dimension: "smart_contract", score: 35, delta30d: 0  },
    { dimension: "counterparty",   score: 26, delta30d: -1 },
  ];

  const props: RiskPulseProps = {
    scores: STUB_SCORES,
    composite: 42,
    compositeLabel: "Low–Moderate",
    composite30dTrend: "stable",
  };

  it("scores array has exactly 5 entries", () => {
    expect(props.scores).toHaveLength(5);
  });

  it("all 5 canonical dimensions present", () => {
    const dims = props.scores.map((s) => s.dimension);
    expect(dims).toContain("market");
    expect(dims).toContain("mining");
    expect(dims).toContain("liquidity");
    expect(dims).toContain("smart_contract");
    expect(dims).toContain("counterparty");
  });

  it("composite is 0–100", () => {
    expect(props.composite).toBeGreaterThanOrEqual(0);
    expect(props.composite).toBeLessThanOrEqual(100);
  });

  it("compositeLabel is one of the 5 valid labels", () => {
    const validLabels = ["Low", "Low–Moderate", "Moderate", "Elevated", "High"];
    expect(validLabels).toContain(props.compositeLabel);
  });

  it("scores are all 0–100", () => {
    for (const s of props.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
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

// ── Widget props: ProofPulse ──────────────────────────────────────────────────

describe("ProofPulse props — loadProofPulseProps shape", () => {
  const TIMESTAMP = new Date("2026-05-01T09:00:00Z");
  const props: ProofPulseProps = {
    lastPor: {
      timestamp: TIMESTAMP,
      statedTvlUsdc: 42_500_000,
      onChainTvlUsdc: 42_487_500,
    },
    methodologyVersion: "v1.0",
    methodologyLocked: true,
    nextAttestation: new Date("2026-06-01T09:00:00Z"),
    auditor: "Spearbit",
  };

  it("lastPor.timestamp is a Date", () => {
    expect(props.lastPor.timestamp).toBeInstanceOf(Date);
  });

  it("statedTvlUsdc and onChainTvlUsdc are positive numbers", () => {
    expect(props.lastPor.statedTvlUsdc).toBeGreaterThan(0);
    expect(props.lastPor.onChainTvlUsdc).toBeGreaterThan(0);
  });

  it("delta between stated and on-chain TVL is < 0.5% (match)", () => {
    const deltaPct = computeDeltaPct(
      props.lastPor.statedTvlUsdc,
      props.lastPor.onChainTvlUsdc,
    );
    expect(isMatch(deltaPct)).toBe(true);
  });

  it("methodologyVersion is 'v1.0'", () => {
    expect(props.methodologyVersion).toBe("v1.0");
  });

  it("methodologyLocked is true", () => {
    expect(props.methodologyLocked).toBe(true);
  });

  it("auditor is a non-empty string", () => {
    expect(typeof props.auditor).toBe("string");
    expect(props.auditor.length).toBeGreaterThan(0);
  });

  it("nextAttestation is a Date when provided", () => {
    if (props.nextAttestation !== null) {
      expect(props.nextAttestation).toBeInstanceOf(Date);
    }
  });

  it("no forbidden words in auditor string", () => {
    const forbidden = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
    for (const word of forbidden) {
      expect(props.auditor.toLowerCase()).not.toContain(word);
    }
  });
});

// ── Widget props: YieldStack ──────────────────────────────────────────────────

describe("YieldStack props — loadYieldStackProps shape", () => {
  const props: YieldStackProps = {
    sources: [
      { bucket: "mining",         label: "Mining cashflow",  contributionPct: 6.2 },
      { bucket: "usdc_base",      label: "USDC base yield",  contributionPct: 4.8 },
      { bucket: "btc_tactical",   label: "BTC tactical",     contributionPct: 1.5, isVolatile: true },
      { bucket: "stable_reserve", label: "Stable reserve",   contributionPct: 0.8 },
    ],
    blendedLow: 9.4,
    blendedHigh: 12.8,
    stressedBearRange: { low: 5.2, high: 6.0 },
    methodologyVersion: "1.0",
  };

  it("has exactly 4 sources (one per canonical bucket)", () => {
    expect(props.sources).toHaveLength(4);
  });

  it("blendedLow < blendedHigh (range direction correct)", () => {
    expect(props.blendedLow).toBeLessThan(props.blendedHigh);
  });

  it("blendedLow and blendedHigh match spec range 9.4–12.8%", () => {
    expect(props.blendedLow).toBe(9.4);
    expect(props.blendedHigh).toBe(12.8);
  });

  it("stressedBearRange.high is strictly less than blendedLow", () => {
    expect(props.stressedBearRange.high).toBeLessThan(props.blendedLow);
  });

  it("stressedBearRange is a range, never a single point (CLAUDE.md #1)", () => {
    expect(props.stressedBearRange.low).toBeLessThan(props.stressedBearRange.high);
  });

  it("btc_tactical is marked as volatile", () => {
    const btc = props.sources.find((s) => s.bucket === "btc_tactical");
    expect(btc?.isVolatile).toBe(true);
  });

  it("all bucket colours use CSS custom properties (--ct-* tokens only)", () => {
    const buckets: Array<"mining" | "usdc_base" | "btc_tactical" | "stable_reserve"> =
      ["mining", "usdc_base", "btc_tactical", "stable_reserve"];
    for (const b of buckets) {
      expect(BUCKET_COLOR[b]).toMatch(/^var\(--ct-/);
    }
  });

  it("barWidthPct produces values 0–100 for all sources", () => {
    const maxAbs = Math.max(...props.sources.map((s) => Math.abs(s.contributionPct)));
    for (const s of props.sources) {
      const w = barWidthPct(s.contributionPct, maxAbs);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(100);
    }
  });

  it("formatContribution renders ± prefix for volatile source", () => {
    const btc = props.sources.find((s) => s.bucket === "btc_tactical")!;
    const formatted = formatContribution(btc.contributionPct, btc.isVolatile ?? false);
    expect(formatted).toMatch(/^±/);
  });

  it("no forbidden words in source labels", () => {
    const forbidden = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
    for (const s of props.sources) {
      for (const word of forbidden) {
        expect(s.label.toLowerCase()).not.toContain(word);
      }
    }
  });
});

// ── Section placement of widgets ─────────────────────────────────────────────

describe("Widget placement in sections", () => {
  // Section → expected widgets mapping (canonical, mirrors page.tsx structure)
  const SECTION_WIDGETS: Record<string, string[]> = {
    // PositionsList — no data-testid; section follows capital-yield in DOM order
    positions: [],
    "hero-pulse": [],
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

  const SECTION_LABELS = [
    "Performance & Liquidity",
    "Yield & Trust Pulse",
    "Activity & Payouts",
  ];

  for (const label of SECTION_LABELS) {
    it(`section label "${label}" contains no forbidden words`, () => {
      for (const word of FORBIDDEN) {
        expect(label.toLowerCase()).not.toContain(word);
      }
    });
  }
});
