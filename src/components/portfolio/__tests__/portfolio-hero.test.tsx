import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortfolioHero } from "@/components/portfolio/portfolio-hero";

describe("PortfolioHero", () => {
  it("renders a single unified hero surface with shared header and split body", () => {
    const html = renderToStaticMarkup(
      <PortfolioHero
        hasPositions
        positions={[
          {
            id: "p1",
            valueUsdc: 260_000,
            principalUsdc: 250_000,
            status: "active",
          },
        ]}
        totalValueUsdc={260_000}
        deployedUsdc={250_000}
        accruedYieldUsdc={10_000}
        positionsCount={1}
        source="live"
        updatedAt={new Date("2026-06-26T12:00:00Z")}
        valueChartTransactions={[
          { type: "deposit", amountUsdc: 250_000, occurredAt: new Date("2026-01-01") },
        ]}
      />,
    );

    expect(html).toContain("pf-hero-grid");
    expect(html).toContain("pf-hero-header");
    expect(html).toContain("pf-hero-body");
    expect(html).toContain("Portfolio Value");
    expect(html).toContain("Portfolio Status");
    expect(html).toContain("pf-value-chart__chart-slot");
    expect(html).not.toContain("pf-pv-summary");
    expect((html.match(/pf-hero-grid/g) ?? []).length).toBe(1);
  });
});
