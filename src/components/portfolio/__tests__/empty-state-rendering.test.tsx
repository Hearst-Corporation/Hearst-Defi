/**
 * Portfolio empty-state rendering — structural contract.
 *
 * Design rule (docs/DESIGN_SYSTEM.md §9):
 * Empty states replace active module surfaces; they are not rendered inside
 * active module surfaces.
 *
 * Uses renderToStaticMarkup (node env, no jsdom).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ValueChart } from "@/components/portfolio/value-chart";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RiskPulse } from "@/components/portfolio/risk-pulse";
import { ProofPulse } from "@/components/portfolio/proof-pulse";
import { SecurityPulse } from "@/components/portfolio/security-pulse";
import { YieldStack } from "@/components/portfolio/yield-stack";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { PositionsList } from "@/components/portfolio/positions-list";
import { TimeseriesSection } from "@/components/dashboard/timeseries-section";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { LockMeter } from "@/components/portfolio/lock-meter";
import { ZERO_YIELD_STACK } from "@/lib/portfolio/layout-preview";

const ZERO_SCORES = [
  { dimension: "market" as const, score: 0, delta30d: 0 },
  { dimension: "mining" as const, score: 0, delta30d: 0 },
  { dimension: "liquidity" as const, score: 0, delta30d: 0 },
  { dimension: "smart_contract" as const, score: 0, delta30d: 0 },
  { dimension: "counterparty" as const, score: 0, delta30d: 0 },
];

/** True when `needle` sits inside an unclosed active module shell. */
function isInsideActiveModuleSurface(html: string, needle: string): boolean {
  const idx = html.indexOf(needle);
  if (idx === -1) return false;

  const before = html.slice(0, idx);
  const shellPatterns = [
    /<div[^>]*glass-panel[^>]*>/g,
    /<article[^>]*dash-cell-premium[^>]*>/g,
  ];
  let lastOpen = -1;
  for (const openRe of shellPatterns) {
    let match: RegExpExecArray | null;
    while ((match = openRe.exec(before)) !== null) {
      lastOpen = Math.max(lastOpen, match.index);
    }
  }
  if (lastOpen === -1) return false;

  const slice = before.slice(lastOpen);
  const openCount = (slice.match(/<(div|article)\b/g) ?? []).length;
  const closeCount = (slice.match(/<\/(div|article)>/g) ?? []).length;
  return openCount > closeCount;
}

function assertEmptyDesignContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(isInsideActiveModuleSurface(html, message)).toBe(false);
  expect(html).not.toContain("dash-cell-premium");
  expect(html).not.toContain("glass-panel");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("Stale");
}

describe("Portfolio empty states — design contract", () => {
  it("ValueChart: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <ValueChart positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    assertEmptyDesignContract(
      html,
      "Value trend will appear after the first active position.",
    );
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("<svg");
  });

  it("AllocationDonut: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <AllocationDonut positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    assertEmptyDesignContract(
      html,
      "Allocation will appear after the first active position.",
    );
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("<svg");
  });

  it("DistribCalendar: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <DistribCalendar entries={[]} shareClass={null} cadence={null} />,
    );
    assertEmptyDesignContract(
      html,
      "Distribution history will appear after the first payout.",
    );
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("PAYOUT CALENDAR");
  });

  it("RiskPulse: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <RiskPulse
        scores={ZERO_SCORES}
        composite={0}
        compositeLabel={undefined}
        composite30dTrend="stable"
      />,
    );
    assertEmptyDesignContract(
      html,
      "Risk scores will appear after the first snapshot.",
    );
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("ProofPulse: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <ProofPulse
        lastPor={{ timestamp: new Date(0), statedTvlUsdc: 0, onChainTvlUsdc: 0 }}
        methodologyVersion=""
        methodologyLocked={false}
        nextAttestation={null}
        auditor=""
      />,
    );
    assertEmptyDesignContract(html, "No attestation has been published yet.");
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("SecurityPulse: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(<SecurityPulse />);
    assertEmptyDesignContract(
      html,
      "Security status will appear after account verification.",
    );
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("AES-256");
    expect(html).not.toContain("Spearbit");
  });

  it("YieldStack: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <YieldStack
        sources={[]}
        blendedLow={9.4}
        blendedHigh={12.8}
        stressedBearRange={{ low: 5.2, high: 6.0 }}
      />,
    );
    assertEmptyDesignContract(
      html,
      "No yield source data yet — awaiting first vault snapshot.",
    );
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("YieldStack previewZeros: full widget shell with zero bars, not awaiting surface", () => {
    const html = renderToStaticMarkup(
      <YieldStack
        sources={ZERO_YIELD_STACK.sources}
        blendedLow={0}
        blendedHigh={0}
        stressedBearRange={{ low: 0, high: 0 }}
        previewZeros
      />,
    );
    expect(html).toContain("glass-panel");
    expect(html).toContain("yield-stack-row");
    expect(html).not.toContain("ct-empty-surface--widget");
  });

  it("RecentActivity: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <RecentActivity transactions={[]} source="fallback" />,
    );
    assertEmptyDesignContract(html, "No transactions yet.");
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("PositionsList: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <PositionsList positions={[]} source="fallback" />,
    );
    assertEmptyDesignContract(html, "No open positions.");
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("TimeToCash: stale source uses awaiting state outside premium surface", () => {
    const html = renderToStaticMarkup(
      <TimeToCash
        cycleStart={new Date("2026-06-01T00:00:00Z")}
        cycleDays={30}
        projectedUsdc={0}
        aprLow={0}
        aprHigh={0}
        source="stale"
      />,
    );
    assertEmptyDesignContract(
      html,
      "Distribution cycle starts after your first active position.",
    );
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("LockMeter: unknown terms uses awaiting state outside premium surface", () => {
    const html = renderToStaticMarkup(
      <LockMeter
        lockStart={new Date("2026-01-01T00:00:00Z")}
        softLockupDays={0}
        earlyExitPenaltyBps={150}
        source="stale"
      />,
    );
    assertEmptyDesignContract(
      html,
      "Lock and liquidity terms appear after your first active position.",
    );
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("TimeseriesSection: empty charts outside Card shell", () => {
    const html = renderToStaticMarkup(
      <TimeseriesSection
        data={{ nav30d: [], apy30d: [], source: "fallback" }}
      />,
    );
    assertEmptyDesignContract(html, "No historical data yet — first snapshot needed.");
    expect(html).toContain("ct-empty-surface--chart");
    expect(html).not.toContain("border-dashed");
  });
});

describe("Portfolio populated states — Card shell preserved", () => {
  it("ValueChart with data renders active card + svg", () => {
    const html = renderToStaticMarkup(
      <ValueChart
        positions={[
          {
            id: "p1",
            vaultName: "Hearst Yield Vault",
            principalUsdc: 500_000,
            accruedYieldUsdc: 0,
            distributedUsdc: 0,
            valueUsdc: 500_000,
            status: "active",
            apyLow: 9.4,
            apyHigh: 12.8,
            subscribedAt: new Date("2025-11-20T00:00:00Z"),
          },
        ]}
        totalValueUsdc={500_000}
        source="live"
      />,
    );
    expect(html).toContain("glass-panel");
    expect(html).toContain("<svg");
    expect(html).not.toContain("ct-empty-surface--chart");
  });
});
