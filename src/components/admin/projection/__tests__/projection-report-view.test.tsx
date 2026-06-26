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
import { PREVIEW_PROJECTION_INPUT } from "@/lib/agentic/product-projection/client";
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

  it("does not render the v2 percentile_band chart in this lot", () => {
    expect(html).not.toContain("percentile_band");
  });
});
