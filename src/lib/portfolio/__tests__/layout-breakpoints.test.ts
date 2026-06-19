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

  it("cockpit mid + trio rows align main|rail seam with hero at 58rem slot", () => {
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 58rem\)[\s\S]*?\.pf-cockpit-row--mid[\s\S]*?1\.6fr/,
    );
    expect(portfolioCss).toMatch(
      /@container pf \(min-width: 58rem\)[\s\S]*?\.pf-cockpit-row--trio[\s\S]*?1\.6fr/,
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

  it("viewport-fit locks height only on wide+tall screens (≥80rem × ≥52rem)", () => {
    expect(portfolioCss).toMatch(
      /@media \(min-width: 80rem\) and \(min-height: 52rem\)[\s\S]*?\.pf-container--fit[\s\S]*?overflow: hidden/,
    );
    expect(portfolioCss).toMatch(
      /@media not all and \(min-width: 80rem\) and \(min-height: 52rem\)[\s\S]*?\.pf-container--fit[\s\S]*?overflow: visible/,
    );
  });

  it("hub fit variant locks viewport height and delegates scroll to panel cells", () => {
    expect(portfolioCss).toMatch(/\.pf-cockpit[\s\S]*?display: flex/);
    expect(portfolioCss).toMatch(
      /\.pf-cockpit-cell[\s\S]*?overflow: visible/,
    );
  });

  it("loading skeleton mirrors the live cockpit bento (hero + mid + trio)", () => {
    expect(portfolioLoading).toContain('className="pf-cockpit"');
    expect(portfolioLoading).toContain("pf-cockpit-row--summary");
    // Recoded: skeleton mirrors the unconditional cockpit (no onboarding branch).
    expect(portfolioLoading).toContain("pf-cockpit-row--mid");
    expect(portfolioLoading).toContain("pf-cockpit-row--trio");
    expect(portfolioLoading).not.toContain("pf-cockpit-row--onboarding-foot");
    expect(portfolioLoading).not.toContain("pf-teaser-grid");
  });

  it("positions ledger reflows on a tight slot instead of a fixed min-width floor", () => {
    // Recoded positions: container-query column drop, no horizontal scroll floor.
    expect(portfolioCss).toMatch(
      /@container pf-panel \(max-width: 30rem\)[\s\S]*?\.pf-positions__row/,
    );
    expect(portfolioCss).not.toContain("min-width: max(100%, 30rem)");
  });

  it("hero sidebar exposes pf-rail container for slot-responsive copy", () => {
    expect(portfolioCss).toMatch(
      /\.pf-hero-sidebar[\s\S]*?container-name: pf-rail/,
    );
    expect(portfolioCss).toContain("PORTFOLIO BOX COPY");
    expect(portfolioCss).toMatch(
      /@container pf-rail \(max-width: 22rem\)[\s\S]*?\.pf-hero-rail-blurb/,
    );
  });

  it("each cockpit panel tier scales header and empty-state copy", () => {
    expect(portfolioCss).toMatch(
      /@container pf-panel \(max-width: 28rem\)[\s\S]*?\.pf-cockpit-panel__title--primary/,
    );
    expect(portfolioCss).toContain(".pf-positions-empty__hint");
    expect(portfolioCss).toContain(".pf-activity__empty-hint");
    expect(portfolioCss).toContain(".cy-panel__empty-copy");
    expect(portfolioCss).toContain(".pf-trust-compact__zero-hint");
  });
});
