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

import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
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

const ZERO_SCORES = [
  { dimension: "market" as const, score: 0, delta30d: 0 },
  { dimension: "mining" as const, score: 0, delta30d: 0 },
  { dimension: "liquidity" as const, score: 0, delta30d: 0 },
  { dimension: "smart_contract" as const, score: 0, delta30d: 0 },
  { dimension: "counterparty" as const, score: 0, delta30d: 0 },
];

/** True when `needle` sits inside an unclosed article.dash-cell-premium. */
function isInsideActiveModuleSurface(html: string, needle: string): boolean {
  const idx = html.indexOf(needle);
  if (idx === -1) return false;

  const before = html.slice(0, idx);
  const openRe = /<article[^>]*dash-cell-premium[^>]*>/g;
  let lastOpen = -1;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(before)) !== null) {
    lastOpen = match.index;
  }
  if (lastOpen === -1) return false;

  const slice = before.slice(lastOpen);
  const openCount = (slice.match(/<article/g) ?? []).length;
  const closeCount = (slice.match(/<\/article>/g) ?? []).length;
  return openCount > closeCount;
}

function assertEmptyDesignContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(isInsideActiveModuleSurface(html, message)).toBe(false);
  expect(html).not.toContain("dash-cell-premium");
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
    expect(html).toContain("pf-empty-chart");
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
    expect(html).toContain("pf-empty-chart");
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
    expect(html).toContain("pf-empty-chart");
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
    expect(html).toContain("pf-empty-widget");
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
    expect(html).toContain("pf-empty-widget");
  });

  it("SecurityPulse: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(<SecurityPulse />);
    assertEmptyDesignContract(
      html,
      "Security status will appear after account verification.",
    );
    expect(html).toContain("pf-empty-widget");
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
    expect(html).toContain("pf-empty-widget");
  });

  it("Yield+allocation row: grouped empty is one pf-empty-widget, not chart+donut", () => {
    const html = renderToStaticMarkup(
      <AwaitingMetricState
        message="Yield and allocation appear after your first active position."
        detail="The forward yield stack and position breakdown populate once deposited capital is confirmed."
      />,
    );
    assertEmptyDesignContract(
      html,
      "Yield and allocation appear after your first active position.",
    );
    expect(html).toContain("pf-empty-widget");
    expect(html).not.toContain("pf-empty-chart");
    expect(html).not.toContain("pf-empty-chart--round");
  });

  it("RecentActivity: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <RecentActivity transactions={[]} source="fallback" />,
    );
    assertEmptyDesignContract(html, "No transactions yet.");
    expect(html).toContain("pf-empty-widget");
  });

  it("PositionsList: empty message outside active module surface", () => {
    const html = renderToStaticMarkup(
      <PositionsList positions={[]} source="fallback" />,
    );
    assertEmptyDesignContract(html, "No open positions.");
    expect(html).toContain("pf-empty-widget");
  });

  it("TimeseriesSection: empty charts outside Card shell", () => {
    const html = renderToStaticMarkup(
      <TimeseriesSection
        data={{ nav30d: [], apy30d: [], source: "fallback" }}
      />,
    );
    assertEmptyDesignContract(html, "No historical data yet — first snapshot needed.");
    expect(html).toContain("pf-empty-chart");
    expect(html).not.toContain("border-dashed");
  });
});

describe("Portfolio populated states — dash-cell-premium preserved", () => {
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
    expect(html).toContain("dash-cell-premium");
    expect(html).toContain("<svg");
    expect(html).not.toContain("pf-empty-chart");
  });
});
