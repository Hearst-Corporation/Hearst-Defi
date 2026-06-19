import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const portfolioCss = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/portfolio.css"),
  "utf8",
);

const portfolioLoading = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/loading.tsx"),
  "utf8",
);

describe("portfolio layout breakpoints", () => {
  it("defines --pf-bp-* aliases on .pf-container", () => {
    expect(portfolioCss).toContain("--pf-bp-hero-2col: 58rem");
    expect(portfolioCss).toContain("--pf-bp-teaser-2col: 30rem");
    expect(portfolioCss).toContain("--pf-bp-teaser-3col: 42rem");
    expect(portfolioCss).toContain("--pf-bp-teaser-4col: 72rem");
    expect(portfolioCss).toContain("--pf-bp-activity-2col: 52rem");
    expect(portfolioCss).toContain("--pf-bp-chart-compact: 36rem");
    expect(portfolioCss).toContain("--pf-bp-sidebar-compact: 42rem");
  });

  it("hero and activity grids use mobile-first min-width container queries (literal values — var() forbidden in @container)", () => {
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 58rem\)[\s\S]*?\.pf-hero-grid/,
    );
    expect(portfolioCss).toMatch(
      /\.pf-activity-grid[\s\S]*?grid-template-columns: 1fr/,
    );
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 52rem\)[\s\S]*?\.pf-activity-grid/,
    );
  });

  it("cockpit mid row goes 2-col at activity breakpoint (52rem slot)", () => {
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 52rem\)[\s\S]*?\.pf-cockpit-row--mid/,
    );
  });

  it("cockpit trio row tiers 1→2→3 columns by content-slot width", () => {
    expect(portfolioCss).toMatch(
      /\.pf-cockpit-row--trio[\s\S]*?grid-template-columns: 1fr/,
    );
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 36rem\)[\s\S]*?\.pf-cockpit-row--trio/,
    );
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 58rem\)[\s\S]*?\.pf-cockpit-row--trio/,
    );
  });

  it("viewport-fit locks height only on wide+tall screens (≥80rem × ≥48rem)", () => {
    expect(portfolioCss).toMatch(
      /@media \(min-width: 80rem\) and \(min-height: 48rem\)[\s\S]*?\.pf-container--fit[\s\S]*?overflow: hidden/,
    );
    expect(portfolioCss).toMatch(
      /@media not all and \(min-width: 80rem\) and \(min-height: 48rem\)[\s\S]*?\.pf-container--fit[\s\S]*?overflow: visible/,
    );
  });

  it("hub fit variant locks viewport height and delegates scroll to panel cells", () => {
    expect(portfolioCss).toMatch(/\.pf-cockpit[\s\S]*?display: flex/);
    expect(portfolioCss).toMatch(
      /\.pf-cockpit-cell[\s\S]*?overflow: visible/,
    );
  });

  it("loading skeleton mirrors the cockpit bento structure", () => {
    expect(portfolioLoading).toContain('className="pf-cockpit"');
    expect(portfolioLoading).toContain("pf-cockpit-row--summary");
    // Onboarding (previewZeros) skeleton: a hero summary row + a compact
    // secondary foot row — mirrors the CTA-led zero-state, not the live mid/trio.
    expect(portfolioLoading).toContain("pf-cockpit-row--onboarding-foot");
    expect(portfolioLoading).not.toContain("pf-teaser-grid");
  });

  it("positions table scrolls horizontally instead of a fixed min-width floor", () => {
    expect(portfolioCss).toMatch(
      /\.pf-positions-table[\s\S]*?overflow-x: auto/,
    );
    expect(portfolioCss).not.toContain("min-width: max(100%, 30rem)");
  });
});
