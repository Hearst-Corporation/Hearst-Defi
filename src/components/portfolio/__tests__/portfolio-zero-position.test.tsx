import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CapitalYield } from "@/components/portfolio/capital-yield";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import {
  ZERO_YIELD_STACK,
  buildZeroDistribEntries,
  zeroProofPulseProps,
} from "@/lib/portfolio/layout-preview";

const PREVIEW_AS_OF = new Date("2026-06-11T00:00:00Z");

describe("Portfolio previewZeros — honest empty widgets", () => {
  it("CapitalYield previewZeros: keeps the full instrument structure", () => {
    const html = renderToStaticMarkup(
      <CapitalYield
        {...ZERO_YIELD_STACK}
        buckets={[]}
        totalValueUsdc={0}
        previewZeros
      />,
    );
    expect(html).toContain("Awaiting snapshot");
    expect(html).toContain("dash-chart-svg");
    expect(html).toContain("Mining cashflow");
    expect(html).toContain("Blended fwd range");
  });

  it("DistribCalendar previewZeros: keeps the chart structure with zero bars", () => {
    const html = renderToStaticMarkup(
      <DistribCalendar
        entries={buildZeroDistribEntries(2026)}
        shareClass={null}
        cadence={null}
        previewZeros
      />,
    );
    expect(html).toContain("pf-distrib-chart");
    expect(html).toContain("12m · USDC");
    expect(html).not.toContain(
      "Payout schedule appears after your first confirmed position.",
    );
  });

  it("RecentActivity previewZeros: compact copy, no tall empty shell", () => {
    const html = renderToStaticMarkup(
      <RecentActivity transactions={[]} source="fallback" previewZeros />,
    );
    expect(html).toContain("No transactions yet");
    expect(html).toContain("Deposits and payouts will appear here");
    expect(html).not.toContain("ct-panel-status");
  });

  it("TrustProofCompact previewZeros: keeps the KPI structure", () => {
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
    expect(html).toContain("Risk composite");
    expect(html).toContain("Proof status");
    expect(html).toContain("Snapshot pending");
    expect(html).toContain("Preview");
    expect(html).not.toContain("Proof system active");
    expect(html).not.toContain("provenance-badge--strip");
  });
});
