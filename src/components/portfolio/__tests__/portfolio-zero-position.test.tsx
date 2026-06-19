import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { ZERO_YIELD_STACK, zeroProofPulseProps } from "@/lib/portfolio/layout-preview";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

describe("Portfolio previewZeros — honest empty widgets", () => {
  it("CapitalYield previewZeros: compact empty copy, no donut", () => {
    const html = renderToStaticMarkup(
      <CapitalYield
        {...ZERO_YIELD_STACK}
        buckets={[]}
        totalValueUsdc={0}
        previewZeros
      />,
    );
    expect(html).toContain(
      "Yield allocation appears after your first confirmed position.",
    );
    expect(html).not.toContain("Awaiting snapshot");
    expect(html).not.toContain("dash-chart-svg");
    expect(html).not.toContain("Mining cashflow");
  });

  it("DistribCalendar previewZeros: compact empty copy, no chart", () => {
    const html = renderToStaticMarkup(
      <DistribCalendar entries={[]} shareClass={null} cadence={null} previewZeros />,
    );
    expect(html).toContain(
      "Payout schedule appears after your first confirmed position.",
    );
    expect(html).not.toContain("pf-distrib-chart");
    expect(html).not.toContain("$0 forecast");
  });

  it("RecentActivity previewZeros: compact copy, no tall empty shell", () => {
    const html = renderToStaticMarkup(
      <RecentActivity transactions={[]} source="fallback" previewZeros />,
    );
    expect(html).toContain("No transactions yet");
    expect(html).toContain("Deposits and payouts will appear here");
    expect(html).not.toContain("ct-panel-status");
  });

  it("TrustProofCompact previewZeros: compact proof system active", () => {
    const html = renderToStaticMarkup(
      <TrustProofCompact
        risk={{
          scores: [
            { dimension: "market", score: 0, delta30d: 0 },
            { dimension: "mining", score: 0, delta30d: 0 },
            { dimension: "liquidity", score: 0, delta30d: 0 },
            { dimension: "smart_contract", score: 0, delta30d: 0 },
            { dimension: "counterparty", score: 0, delta30d: 0 },
          ],
          composite: 0,
          compositeLabel: undefined,
          composite30dTrend: "stable",
        }}
        proof={zeroProofPulseProps(PREVIEW_AS_OF)}
        previewZeros
      />,
    );
    expect(html).toContain("Proof system active");
    expect(html).toContain("/proof-center");
    expect(html).not.toContain("provenance-badge--strip");
  });
});
