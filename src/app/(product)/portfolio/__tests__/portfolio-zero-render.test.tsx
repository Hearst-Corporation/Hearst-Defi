/**
 * Portfolio no-scroll dashboard — top-level composition contract.
 *
 * No demo / no previewZeros / no zero-state. The cockpit always renders
 * with real data; widgets show inline placeholders when data is absent.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const portfolioPage = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/page.tsx"),
  "utf8",
);

describe("Portfolio dashboard — top-level contract", () => {
  it("live dashboard renders the cockpit bento with all hub widgets", () => {
    const requiredMarkers = [
      'className="pf-cockpit"',
      "pf-cockpit-row--summary",
      "pf-cockpit-row--mid",
      "pf-cockpit-row--trio",
      'data-testid="capital-yield-widget"',
      'data-testid="trust-panel-widget"',
      'data-testid="recent-activity-widget"',
      'data-testid="distrib-calendar-widget"',
      'data-section="positions"',
      'data-section="activity-payouts"',
      "<ValueChart",
      "<HeroPayoutRail",
      "<HeroLiquidityRail",
      "pf-container--fit",
    ];

    for (const marker of requiredMarkers) {
      expect(portfolioPage).toContain(marker);
    }
  });

  it("dashboard top level does not use the retired teaser-row layout", () => {
    expect(portfolioPage).not.toContain("pf-teaser-grid");
    expect(portfolioPage).not.toContain("PortfolioTeaserTile");
    expect(portfolioPage).not.toContain('data-section="hero-pulse"');
  });

  it("no demo or zero-state layer — always renders the cockpit directly", () => {
    // No demo banner, no previewZeros, no zero-state classes.
    expect(portfolioPage).toContain('"pf-container pf-container--fit"');
    expect(portfolioPage).not.toContain("DemoDataBanner");
    expect(portfolioPage).not.toContain("previewZeros");
    expect(portfolioPage).not.toContain("pf-container--zero");
    expect(portfolioPage).not.toContain("pf-container--onboarding");
    expect(portfolioPage).not.toContain("PortfolioOnboardingHero");
    expect(portfolioPage).not.toContain("heroWidgets");
    // Hero sidebar (KPI + payout + liquidity) always present — no conditional gate.
    expect(portfolioPage).toContain("<HeroKpiTable");
    expect(portfolioPage).toContain('"pf-hero-sidebar"');
  });
});
