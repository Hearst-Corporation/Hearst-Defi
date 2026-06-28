import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MISSION #034 — /portfolio real-data contract.
 *
 * Regression cover for the former 100% static mock page (hardcoded $509,800 /
 * $500,000 / $9,800 / $8,380 demo activity under a "Demo data" badge). The page
 * now BINDS the real loader (loadPortfolioView) and renders on HIS primitives,
 * so the investor sees the same truth as /profile & /admin/customers.
 *
 * Text assertions on the page source (same approach as the other contracts).
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const page = stripComments(
  read("src/app/(product)/portfolio/page.tsx"),
);

describe("portfolio binds real data (no static mock)", () => {
  it("consumes the real view-model loader", () => {
    expect(page).toMatch(/loadPortfolioView\(\)/);
    expect(page).toMatch(/export default async function PortfolioPage/);
  });

  it("renders on HIS data-viz primitives (not the legacy mock chart)", () => {
    expect(page).toMatch(/@\/components\/dataviz\/his/);
    expect(page).toMatch(/HcChartCard/);
    expect(page).toMatch(/HcMetricSparkline/);
    expect(page).toMatch(/HcCompositionRing/);
  });

  it("contains NONE of the old mock literals", () => {
    for (const lit of ["509,800", "509800", "500,000", "8,380", "9,800", "98.0%"]) {
      expect(page, `mock literal ${lit} must be gone`).not.toContain(lit);
    }
  });

  it("never ships a 'Demo data' badge or a chart placeholder", () => {
    expect(page).not.toMatch(/Demo data/);
    expect(page).not.toMatch(/Chart Placeholder/);
  });

  it("derives headline + principal from the loader, not hardcodes", () => {
    expect(page).toMatch(/formatUsdFull\(totalValueUsdc\)/);
    expect(page).toMatch(/formatUsdFull\(deployedUsdc\)/);
  });

  it("is DS-clean: no raw hex / zinc / white-alpha / hardcoded type sizes", () => {
    expect(page).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(page).not.toMatch(/text-zinc-/);
    expect(page).not.toMatch(/border-white\//);
    expect(page).not.toMatch(/bg-white\//);
    expect(page).not.toMatch(/text-\[1[0-9]px\]/);
  });
});
