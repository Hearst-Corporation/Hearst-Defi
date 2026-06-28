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
    // No derived APY/hashprice/energy value is presented as a suggestion.
    expect(lower).not.toContain("apy target");
    expect(lower).not.toContain("suggested apy");
    expect(lower).not.toContain("product created");
    expect(lower).not.toContain("vault created");
    expect(lower).not.toContain("run launched");
    expect(lower).not.toContain("investor-ready");
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
