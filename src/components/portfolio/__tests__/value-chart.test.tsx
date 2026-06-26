import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortfolioValueSummary } from "@/components/portfolio/portfolio-value-summary";

describe("PortfolioValueSummary", () => {
  it("renders Portfolio Value title", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={0}
        positionsCount={0}
        deployedUsdc={0}
        source="live"
        embedded
      />,
    );

    expect(html).toContain("Portfolio Value");
  });

  it("renders empty state when no positions", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={0}
        positionsCount={0}
        deployedUsdc={0}
        source="live"
        embedded
      />,
    );

    expect(html).toContain("No position yet");
    expect(html).not.toContain("pf-value-chart__chart-slot");
    expect(html).not.toContain("pf-value-chart__plot");
    expect(html).not.toContain("<svg");
  });

  it("renders the NAV value when not empty", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={260_000}
        positionsCount={1}
        deployedUsdc={250_000}
        source="live"
        embedded
        updatedAt={new Date("2026-06-26T12:00:00Z")}
      />,
    );

    expect(html).toContain("260,000");
    expect(html).toContain("Estimated NAV");
  });

  it("renders positions count and deployed pct in meta row", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={11}
        positionsCount={1}
        deployedUsdc={11}
        source="live"
        embedded
      />,
    );

    expect(html).toContain("1 active position");
    expect(html).toContain("100% deployed");
    expect(html).toContain("Proof current");
    expect((html.match(/pf-pv-summary__meta-item/g) ?? []).length).toBe(3);
    expect(html).not.toContain("pf-pv-summary__meta-sep");
  });

  it("renders ledger note", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={11}
        positionsCount={1}
        deployedUsdc={11}
        source="live"
        embedded
      />,
    );

    expect(html).toContain("Ledger-based valuation");
  });

  it("contains no SVG chart elements", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={260_000}
        positionsCount={1}
        deployedUsdc={250_000}
        source="live"
        embedded
      />,
    );

    expect(html).not.toContain("<svg");
    expect(html).not.toContain("pf-value-chart__plot");
    expect(html).not.toContain("pf-value-chart__chart-slot");
    expect(html).not.toContain("pf-vc-svg");
    expect(html).not.toContain("pf-vc-line");
    expect(html).not.toContain("pf-vc-area");
    expect(html).not.toContain("pf-vc-axis-label");
  });

  it("contains no range selector buttons (24H/7D/30D/ALL)", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={260_000}
        positionsCount={1}
        deployedUsdc={250_000}
        source="live"
        embedded
      />,
    );

    expect(html).not.toContain("24H");
    expect(html).not.toContain("7D");
    expect(html).not.toContain("30D");
    expect(html).not.toContain(">ALL<");
  });

  it("renders date when updatedAt is provided", () => {
    const html = renderToStaticMarkup(
      <PortfolioValueSummary
        totalValueUsdc={11}
        positionsCount={1}
        deployedUsdc={11}
        source="live"
        embedded
        updatedAt={new Date("2026-06-26T12:00:00Z")}
      />,
    );

    expect(html).toContain("Jun 26");
  });
});
