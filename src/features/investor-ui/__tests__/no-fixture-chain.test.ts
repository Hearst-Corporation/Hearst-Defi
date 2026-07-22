/**
 * Fixture-purge guard (2026-07-22).
 *
 * The investor-ui fixture chain — FixtureInvestorUiDataSource, 16 fixture
 * files carrying realistic figures ($250k deposits, full dashboards, a
 * $2.779M reserve), and the never-mounted components that consumed them —
 * was removed after closing its import graph: no route rendered any of it,
 * and its only possible future was being reconnected by mistake and shipping
 * invented numbers to a client surface.
 *
 * These guards keep the chain gone. They are file-existence checks, not
 * behaviour checks, because the property being protected is structural:
 * client-facing code cannot fall back to a fixture THAT DOES NOT EXIST.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function abs(rel: string): string {
  return join(process.cwd(), rel);
}

/** Strip comments so a doc block EXPLAINING the purge cannot trip a guard —
 *  the classic comment-matching false positive this repo keeps hitting. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("fixture purge — the chain stays deleted", () => {
  it("the fixtures directory is gone", () => {
    expect(existsSync(abs("src/features/investor-ui/fixtures"))).toBe(false);
  });

  it("the fixture data source and the orphan profile data source are gone", () => {
    expect(existsSync(abs("src/features/investor-ui/data-source/fixture-data-source.ts"))).toBe(false);
    expect(existsSync(abs("src/features/investor-ui/data-source/profile-data-source.ts"))).toBe(false);
  });

  it("the data-source factory can only return the backend implementation", () => {
    const barrel = stripComments(
      readFileSync(abs("src/features/investor-ui/data-source/index.ts"), "utf8"),
    );
    expect(barrel).toContain("BackendInvestorUiDataSource");
    expect(barrel).not.toContain("FixtureInvestorUiDataSource");
    expect(barrel).not.toContain("getFixtureInvestorUiDataSource");
  });

  it("the never-mounted components with illustrative series are gone", () => {
    for (const rel of [
      "src/features/investor-ui/components/accumulation-chart-signature.tsx",
      "src/features/investor-ui/components/analyst-note-panel.tsx",
      "src/features/investor-ui/components/ask-strategist-button.tsx",
      "src/features/investor-ui/components/widgets",
      "src/features/investor-ui/components/reserve-cockpit/BtcAccumulationCurve.tsx",
    ]) {
      expect(existsSync(abs(rel)), `${rel} must stay deleted`).toBe(false);
    }
  });

  it("the +15% strategic inflation and the illustrative pace are gone from the series module", () => {
    const series = stripComments(
      readFileSync(abs("src/features/investor-ui/charts/accumulation-series.ts"), "utf8"),
    );
    expect(series).not.toContain("buildAccumulationSeries(");
    expect(series).not.toContain("withIllustrativePace");
    expect(series).not.toContain("strategicRatio = 0.15");
    // The honest derivation the admin gallery renders survives.
    expect(series).toContain("export function toMonthlyDeltas");
  });

  it("no client-facing module imports a fixture path anymore", () => {
    // Structural sweep over the one directory that could re-grow the chain.
    const barrel = stripComments(readFileSync(abs("src/features/investor-ui/data-source/index.ts"), "utf8"));
    const backend = stripComments(readFileSync(
      abs("src/features/investor-ui/data-source/backend-data-source.ts"),
      "utf8",
    ));
    for (const src of [barrel, backend]) {
      expect(src).not.toMatch(/from ["']\.\.\/fixtures/);
      expect(src).not.toMatch(/fixture-data-source/);
    }
  });
});
