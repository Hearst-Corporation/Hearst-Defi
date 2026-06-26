/**
 * Projection Report Preview wrapper — initial (idle) render contract.
 *
 * renderToStaticMarkup covers the first render: prefilled editable fields, posture
 * badges, the allocation fixture note, no raw JSON / prompt leak, no forbidden
 * wording. Interactive validation/blocking is covered by the pure validator tests
 * (validatePreviewDraft / buildPreviewInput) in the client test.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_PREVIEW_DRAFT } from "@/lib/agentic/product-projection/client";
import { ProjectionReportPreview } from "../projection-report-preview";

const FORBIDDEN = ["guarantee", "guaranteed", "promise", "certain", "will deliver", "risk-free", "riskless"];

describe("ProjectionReportPreview (idle render)", () => {
  const html = renderToStaticMarkup(<ProjectionReportPreview />);

  it("prefills the editable fields with the default draft", () => {
    expect(html).toContain(`value="${DEFAULT_PREVIEW_DRAFT.capitalBase}"`);
    expect(html).toContain(`value="${DEFAULT_PREVIEW_DRAFT.apyMin}"`);
    expect(html).toContain(`value="${DEFAULT_PREVIEW_DRAFT.apyMax}"`);
    expect(html).toContain(`value="${DEFAULT_PREVIEW_DRAFT.horizonMonths}"`);
    expect(html).toContain('name="capitalBase"');
    expect(html).toContain('name="apyMin"');
    expect(html).toContain('name="apyMax"');
    expect(html).toContain('name="horizonMonths"');
  });

  it("hides the seed field in v0 mode (default)", () => {
    expect(html).not.toContain('name="seed"');
  });

  it("shows the read-only / no-storage / range-only posture and the allocation fixture", () => {
    expect(html).toContain("Preview input");
    expect(html).toContain("No storage");
    expect(html).toContain("Read-only");
    expect(html).toContain("Range only");
    expect(html).toContain("preview fixture (not editable)");
    expect(html).toContain("Reset");
    expect(html).toContain("Run projection");
  });

  it("leaks no raw JSON and no forbidden / guaranteed-return wording", () => {
    expect(html).not.toContain('"apyRange"');
    expect(html).not.toContain('"methodology"');
    const lower = html.toLowerCase();
    for (const w of FORBIDDEN) expect(lower).not.toContain(w);
  });
});
