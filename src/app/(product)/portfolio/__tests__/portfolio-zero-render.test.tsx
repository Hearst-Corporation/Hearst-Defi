/**
 * Portfolio no-scroll dashboard — top-level composition contract.
 *
 * The dashboard (/portfolio) is a fixed, no-scroll cockpit bento: greeting +
 * three rows (hero summary, positions + yield, trio widgets). Heavy blocks also
 * exist on dedicated leaf pages for focused views; data-testid markers live on
 * BOTH the hub and the leaves.
 *
 * Source-file contract (RSC cannot be rendered under Vitest without a full
 * runtime); encodes what the shipped page.tsx must contain.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const portfolioPage = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/page.tsx"),
  "utf8",
);

describe("Portfolio no-scroll dashboard — top-level contract", () => {
  it("dashboard top level renders the cockpit bento with all hub widgets", () => {
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

  it("honesty at zero-position: preview wiring from shared loader, not fabricated live", () => {
    expect(portfolioPage).toContain('previewZeros && "pf-container--zero"');
    expect(portfolioPage).toContain("ZERO_YIELD_STACK");
    expect(portfolioPage).toContain("zeroProofPulseProps");
    expect(portfolioPage).toContain("zeroTimeToCashProps");
    expect(portfolioPage).toContain("zeroLockMeterProps");
    expect(portfolioPage).toContain("buildZeroDistribEntries");
    expect(portfolioPage).not.toContain("PortfolioTeaserTile");
  });
});
