import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MISSION #034 — /portfolio real-data contract.
 *
 * Regression cover against a static mock page. /portfolio is now the RICH V4
 * vault-health console (same composition as /portfolio/preview) but it BINDS the
 * real loader (loadPortfolioCockpit → loadPortfolioDashboard, derived only from
 * the signed-in account's persisted positions / NAV / yield) and renders on HIS
 * primitives, so the investor sees the same truth as /profile & /admin/customers.
 * The MOCK V4 console (100% fabricated dataset) lives ONLY at /portfolio/preview.
 *
 * The console adds pockets/collateral (Estimated, derived from the real deposit)
 * and mining/risk/agent panels (pilot sample, badged Simulated) — this contract
 * keeps its anti-mock teeth: /portfolio must never import the sandbox mock
 * dataset (./preview/_data/mock) and must never hardcode the mock's demo figures.
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
  it("consumes the real data loader (async page, no static mock)", () => {
    expect(page).toMatch(/export default async function PortfolioPage/);
    // Single view model derived only from the signed-in account's real data
    // (the cockpit loader wraps loadPortfolioDashboard — the real source).
    expect(page).toMatch(/loadPortfolioCockpit/);
  });

  it("renders on HIS data-viz primitives (not a mock chart)", () => {
    expect(page).toMatch(/@\/components\/dataviz\/his/);
    // Hero NAV chart = HcValueChart (fed by real NAV points); realized
    // distributions = HcBarChart. Both are HIS primitives.
    expect(page).toMatch(/HcValueChart/);
    expect(page).toMatch(/HcBarChart/);
  });

  it("imports NONE of the mock V4 data (that lives only under ./preview/_data)", () => {
    // The real dashboard must never pull the sandbox mock dataset.
    expect(page).not.toMatch(/preview\/_data\/mock/);
    // And none of the old hardcoded demo literals survive.
    for (const lit of ["509,800", "509800", "500,000", "8,380", "9,800", "531,400", "531.4k"]) {
      expect(page, `mock literal ${lit} must be gone`).not.toContain(lit);
    }
  });

  it("never ships a 'Demo data' badge or a chart placeholder", () => {
    expect(page).not.toMatch(/Demo data/);
    expect(page).not.toMatch(/Chart Placeholder/);
  });

  it("derives headline + stat band from the loader view model, not hardcodes", () => {
    // The hero stat band and the NAV baseline both come off the derived view
    // model `d`, never a literal. (The hero was recomposed around StatBand —
    // deposit/value figures now flow through d.heroStats.)
    expect(page).toMatch(/StatBand items=\{d\.heroStats\}/);
    expect(page).toMatch(/d\.deployedValueUsdc/);
  });

  it("the cockpit loader itself derives from the REAL dashboard source (not mock)", () => {
    const loader = stripComments(read("src/lib/data/portfolio-cockpit.ts"));
    // The rich view model is built on the real loader, never the sandbox mock.
    expect(loader).toMatch(/loadPortfolioDashboard/);
    expect(loader).not.toMatch(/preview\/_data\/mock/);
    // Pilot operational data is isolated in a clearly-named fixtures module.
    expect(loader).toMatch(/_cockpit\/pilot-fixtures/);
  });

  it("is DS-clean: no raw hex / zinc / white-alpha / hardcoded type sizes", () => {
    expect(page).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(page).not.toMatch(/text-zinc-/);
    expect(page).not.toMatch(/border-white\//);
    expect(page).not.toMatch(/bg-white\//);
    expect(page).not.toMatch(/text-\[1[0-9]px\]/);
  });
});
