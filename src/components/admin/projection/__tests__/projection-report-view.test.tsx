/**
 * Projection Report View — read-only rendering contract.
 *
 * Renders the REAL artifact (via buildProjectionArtifact) — no fabricated
 * fixtures. Asserts APY-as-range, scenarios, assumptions/provenance/disclaimers,
 * missingInputs surfaced, and that no forbidden/guaranteed-return wording or raw
 * prompt/user text leaks into the markup.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildProjectionArtifact } from "@/lib/agentic/product-projection";
import type { ProjectionReportArtifact } from "@/lib/agentic/product-projection";
import {
  PREVIEW_PROJECTION_INPUT,
  PREVIEW_PROJECTION_INPUT_V2,
  PREVIEW_PROJECTION_SEED_V2,
} from "@/lib/agentic/product-projection/client";
import { ProjectionReportView } from "../projection-report-view";

const FORBIDDEN = ["guarantee", "guaranteed", "promise", "certain", "will deliver", "risk-free", "riskless"];

describe("ProjectionReportView", () => {
  const full = buildProjectionArtifact(PREVIEW_PROJECTION_INPUT);
  const html = renderToStaticMarkup(<ProjectionReportView artifact={full} />);

  it("renders the report shell, not a JSON dump", () => {
    expect(html).toContain('data-testid="projection-report"');
    expect(html).not.toContain('"sideEffects"');
    expect(html).not.toContain('"metrics":');
  });

  it("shows APY only as a range", () => {
    expect(html).toMatch(/8[–-]15%/);
    expect(html).toContain("Target APY");
  });

  it("renders bear / base / bull scenarios", () => {
    expect(full.scenarios.map((s) => s.id).sort()).toEqual(["base", "bear", "bull"]);
    for (const s of full.scenarios) expect(html).toContain(s.label);
  });

  it("shows assumptions, provenance and disclaimers", () => {
    expect(html).toContain("Assumptions");
    expect(html).toContain("Provenance");
    for (const d of full.disclaimers) expect(html).toContain(d);
  });

  it("badges the read-only / no-side-effects / preview posture", () => {
    expect(html).toContain("Read-only");
    expect(html).toContain("No side effects");
    expect(html).toContain("Preview input");
  });

  it("contains no forbidden or guaranteed-return wording", () => {
    const lower = html.toLowerCase();
    for (const w of FORBIDDEN) expect(lower).not.toContain(w);
  });

  it("surfaces missingInputs without fabricating numbers (thin input)", () => {
    const thin = buildProjectionArtifact({ productName: "Thin", productType: "fund" });
    const thinHtml = renderToStaticMarkup(<ProjectionReportView artifact={thin} />);
    expect(thin.missingInputs.length).toBeGreaterThan(0);
    expect(thinHtml).toContain("Missing input");
    // No invented APY/yield — the missing metric shows a caveat, not a number.
    expect(thinHtml).toContain("apyRange not provided");
  });

  it("a v0 artifact renders no Methodology v2 section", () => {
    expect(html).not.toContain("Methodology v2");
    expect(html).not.toContain("projpv-band");
    // The literal v2 chart type never leaks as a string either.
    expect(html).not.toContain("percentile_band");
  });
});

describe("ProjectionReportView — Methodology v2", () => {
  const v2 = buildProjectionArtifact(PREVIEW_PROJECTION_INPUT_V2);
  const html = renderToStaticMarkup(<ProjectionReportView artifact={v2} />);

  it("the v2 preview input actually produces a v2 distribution artifact", () => {
    expect(v2.version).toBe("v2");
    expect(v2.distribution).toBeDefined();
    expect(v2.methodology?.seed).toBe(PREVIEW_PROJECTION_SEED_V2);
  });

  it("renders the Methodology v2 section with seed, iterations and model", () => {
    expect(html).toContain("Methodology v2");
    expect(html).toContain(`seed: ${PREVIEW_PROJECTION_SEED_V2}`);
    expect(html).toContain("seeded_scenario_distribution");
    expect(html).toContain(`iterations: ${v2.methodology?.iterations}`);
  });

  it("shows p5 / p50 / p95 percentiles", () => {
    expect(html).toContain(">p5<");
    expect(html).toContain(">p50<");
    expect(html).toContain(">p95<");
    expect(html).toContain("Median scenario");
  });

  it("renders the percentile band visual", () => {
    expect(html).toContain("projpv-band");
    expect(html).toContain("p5–p95 band");
    expect(html).toContain("p50 median");
  });

  it("frames p50 as a median, never a guaranteed/expected return", () => {
    expect(html).toContain("median of a conditional distribution");
    const lower = html.toLowerCase();
    for (const w of FORBIDDEN) expect(lower).not.toContain(w);
  });

  it("emits no NaN/Infinity and no raw JSON dump", () => {
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).not.toContain('"bands":');
    expect(html).not.toContain('"percentiles":');
  });

  it("falls back gracefully when a v2 artifact has no distribution", () => {
    const noDist: ProjectionReportArtifact = {
      ...v2,
      distribution: undefined,
      methodology: undefined,
    };
    const fallback = renderToStaticMarkup(<ProjectionReportView artifact={noDist} />);
    expect(fallback).toContain("Methodology v2");
    expect(fallback).toContain("no distribution available");
    expect(fallback).not.toMatch(/NaN|Infinity/);
  });
});
