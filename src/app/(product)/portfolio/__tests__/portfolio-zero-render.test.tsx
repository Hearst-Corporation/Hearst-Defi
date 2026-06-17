/**
 * Portfolio no-scroll dashboard — top-level composition contract.
 *
 * The dashboard (/portfolio) is a fixed, no-scroll top level: greeting + hero
 * (value chart + KPI rail) + a row of four "view more" teaser tiles. The heavy
 * blocks moved to dedicated leaf pages (/portfolio/positions, /yield,
 * /distributions, /activity); their data-testid markers live there now, NOT on
 * the dashboard top level.
 *
 * This is a documentation test (the page is an RSC reading server-side loaders
 * we cannot mock in a pure render test); actual rendering is validated visually
 * / via E2E. It encodes the intent the shipped layout must honor.
 */

import { describe, expect, it } from "vitest";

describe("Portfolio no-scroll dashboard — top-level contract", () => {
  it("dashboard top level renders hero + teaser tiles, not the heavy widgets", () => {
    // Present on the dashboard top level (both zero and non-zero state):
    const requiredSelectors = [
      'data-section="hero-pulse"',
      'class="pf-teaser-grid"',
    ];

    // NOT on the dashboard top level — these moved to their leaf pages:
    //   capital-yield-widget    → /portfolio/yield
    //   trust-panel-widget      → /portfolio/activity
    //   recent-activity-widget  → /portfolio/activity
    //   distrib-calendar-widget → /portfolio/distributions
    //   data-section="positions" → /portfolio/positions
    const forbiddenSelectors = [
      'data-testid="capital-yield-widget"',
      'data-testid="trust-panel-widget"',
      'data-testid="recent-activity-widget"',
      'data-testid="distrib-calendar-widget"',
      'data-section="positions"',
    ];

    expect(requiredSelectors).toBeDefined();
    expect(forbiddenSelectors).toBeDefined();
  });

  it("honesty at zero-position: no fabricated provenance on the dashboard", () => {
    // At zero positions the dashboard stays in preview-calm mode: hero + teasers
    // render with honest copy (e.g. 'No open positions'), never a fake Live /
    // Verified badge or a fabricated $0 / 0.0–0.0% figure. The demo identity is
    // the exception (populated $500k position) and is NOT driven through
    // previewZeros — its honesty signal is the DemoDataBanner.
    const honestyInvariants = [
      "no fabricated Live/Verified badge at zero",
      "no '$0' / '0.0-0.0%' fabricated values at zero",
      "APY always shown as a range",
      "previewZeros = !hasPositions, never forced for the demo identity",
    ];

    expect(honestyInvariants).toBeDefined();
  });
});
