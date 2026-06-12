/**
 * Portfolio empty-state rendering — structural contract.
 *
 * Empty widgets must NOT render inside dash-cell-premium shells with headers
 * or provenance badges. Uses renderToStaticMarkup (node env, no jsdom).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ValueChart } from "@/components/portfolio/value-chart";
import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RiskPulse } from "@/components/portfolio/risk-pulse";
import { ProofPulse } from "@/components/portfolio/proof-pulse";
import { SecurityPulse } from "@/components/portfolio/security-pulse";

const ZERO_SCORES = [
  { dimension: "market" as const, score: 0, delta30d: 0 },
  { dimension: "mining" as const, score: 0, delta30d: 0 },
  { dimension: "liquidity" as const, score: 0, delta30d: 0 },
  { dimension: "smart_contract" as const, score: 0, delta30d: 0 },
  { dimension: "counterparty" as const, score: 0, delta30d: 0 },
];

describe("Portfolio empty states — no dash-cell-premium shell", () => {
  it("ValueChart empty renders pf-empty-chart without article shell", () => {
    const html = renderToStaticMarkup(
      <ValueChart positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    expect(html).toContain("pf-empty-chart");
    expect(html).toContain("Value trend will appear after the first active position.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("Stale");
    expect(html).not.toContain("<svg");
  });

  it("AllocationDonut empty renders pf-empty-chart without article shell", () => {
    const html = renderToStaticMarkup(
      <AllocationDonut positions={[]} totalValueUsdc={0} source="fallback" />,
    );
    expect(html).toContain("pf-empty-chart");
    expect(html).toContain("Allocation will appear after the first active position.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("<svg");
  });

  it("DistribCalendar empty renders pf-empty-chart without article shell", () => {
    const html = renderToStaticMarkup(
      <DistribCalendar entries={[]} shareClass={null} cadence={null} />,
    );
    expect(html).toContain("pf-empty-chart");
    expect(html).toContain("Distribution history will appear after the first payout.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("PAYOUT CALENDAR");
  });

  it("RiskPulse noData renders pf-empty-widget without article shell", () => {
    const html = renderToStaticMarkup(
      <RiskPulse
        scores={ZERO_SCORES}
        composite={0}
        compositeLabel={undefined}
        composite30dTrend="stable"
      />,
    );
    expect(html).toContain("pf-empty-widget");
    expect(html).toContain("Risk scores will appear after the first snapshot.");
    expect(html).not.toContain("dash-cell-premium");
  });

  it("ProofPulse no attestation renders pf-empty-widget without article shell", () => {
    const html = renderToStaticMarkup(
      <ProofPulse
        lastPor={{ timestamp: new Date(0), statedTvlUsdc: 0, onChainTvlUsdc: 0 }}
        methodologyVersion=""
        methodologyLocked={false}
        nextAttestation={null}
        auditor=""
      />,
    );
    expect(html).toContain("pf-empty-widget");
    expect(html).toContain("No attestation has been published yet.");
    expect(html).not.toContain("dash-cell-premium");
  });

  it("SecurityPulse renders pf-empty-widget (no hardcoded active card)", () => {
    const html = renderToStaticMarkup(<SecurityPulse />);
    expect(html).toContain("pf-empty-widget");
    expect(html).toContain("Security status will appear after account verification.");
    expect(html).not.toContain("dash-cell-premium");
    expect(html).not.toContain("AES-256");
    expect(html).not.toContain("Spearbit");
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
