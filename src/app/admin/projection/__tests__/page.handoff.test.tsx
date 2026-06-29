import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Guard: importing/rendering the handoff path must NEVER reach the run action.
// We spy the actions module; if any of them fired just from rendering the
// handoff, this spy would catch it.
const mockRunStudy = vi.fn();
const mockPromote = vi.fn();
vi.mock("../actions", () => ({
  runProjectionStudy: (...args: unknown[]) => mockRunStudy(...args),
  promoteStudyToDraft: (...args: unknown[]) => mockPromote(...args),
  getPresetInputsForProjection: vi.fn(),
}));

import { ProjectionHandoff } from "@/components/admin/projection/projection-handoff";

function render(objective: string | null) {
  return renderToStaticMarkup(<ProjectionHandoff objective={objective} />);
}

describe("ProjectionHandoff — Projection input draft block", () => {
  it("renders the objective + the input-draft header and honest wording", () => {
    const html = render("Créer une offre Defensive");
    expect(html).toContain("Projection input draft");
    expect(html).toContain("Créer une offre Defensive");
    expect(html).toContain("Draft suggestions only");
    expect(html).toContain("manual Run Study required");
    expect(html).toContain("configured assumptions must");
    expect(html).toContain("not guaranteed");
    expect(html).toContain("GO ADMIN ONLY");
    expect(html).toContain("Nothing has been run");
  });

  it("renders the methodology panel — CONFIGURED assumptions to review + version", () => {
    const html = render("Créer une offre Defensive");
    expect(html).toContain("Assumptions to review");
    expect(html).toContain("methodology v1.0");
    expect(html).toContain("CONFIGURED");
    // The in-code assumption labels + values surface (markup 15%, fees 2%, etc.).
    expect(html).toContain("Machine-cost markup");
    expect(html).toContain("15%");
    expect(html).toContain("Revenue share");
    expect(html).toContain("BTC scenario band");
    // Honest note carried from assumptions metadata.
    expect(html.toLowerCase()).toContain("pas validées");
  });

  it("renders the projection preset block — safe fields + review required, no business number", () => {
    const html = render("Produit mining + stable yield ciblant 20% APY");
    expect(html).toContain("Projection preset from Product Workspace");
    expect(html).toContain("Safe fields prepared");
    expect(html).toContain("Product type: Mining + stable yield");
    expect(html).toContain("Review required (not prefilled)");
    expect(html).toContain("Revenue share (CONFIGURED)");
    expect(html).toContain("No business number is prepared from the objective");
    // The 20% from the objective is NOT surfaced as a prepared APY value.
    expect(html).not.toMatch(/Target APY[^<]*20%/i);
    expect(html).not.toContain("APY target: 20%");
  });

  it("preset block shows an honest 'None' when no safe field is derivable", () => {
    const html = render("un truc sympa pour les gens");
    expect(html).toContain("Projection preset from Product Workspace");
    expect(html).toContain("Set the inputs manually");
  });

  it("surfaces keyword-derived suggestions (product type + buckets) for a mining+stable objective", () => {
    const html = render("Produit DeFi mining + stable yield en USDC");
    expect(html).toContain("Suggested product type");
    expect(html).toContain("Mining + stable yield");
    expect(html).toContain("Suggested structure");
    expect(html).toContain("Mining");
    expect(html).toContain("USDC");
  });

  it("renders an honest fallback when no objective is carried", () => {
    const html = render(null);
    expect(html).toContain("Projection input draft");
    expect(html).toContain("No objective carried from the workspace.");
    // Opaque/empty objective → no product-type suggestion surfaced.
    expect(html).not.toContain("Suggested product type");
  });

  it("never invents a business number or claims a record/run", () => {
    const html = render("Créer un produit mining + stable yield ciblant 10% APY");
    const lower = html.toLowerCase();
    // No derived APY/business VALUE is presented as a prepared field. NOTE:
    // "APY target" appears in the forbidden-prefill boundary text ("no business
    // number is prepared … (APY target, …)") — that is the honest boundary, the
    // opposite of inventing one. We forbid an APY paired with a NUMBER.
    expect(lower).not.toMatch(/apy target\s*[:=]\s*\d/);
    expect(lower).not.toMatch(/(target apy|apy)\s*[:=]?\s*\d+(\.\d+)?\s*%/);
    expect(lower).not.toContain("suggested apy");
    expect(lower).not.toContain("product created");
    expect(lower).not.toContain("vault created");
    expect(lower).not.toContain("run launched");
    expect(lower).not.toContain("guaranteed to");
    // Always reminds that assumptions stay configured.
    expect(lower).toContain("configured");
  });

  it("rendering the handoff block triggers NO projection run or promotion", () => {
    render("Créer une offre Defensive");
    render(null);
    expect(mockRunStudy).not.toHaveBeenCalled();
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
