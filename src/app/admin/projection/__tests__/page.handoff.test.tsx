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

describe("ProjectionHandoff — Product Workspace context block", () => {
  it("renders the objective + honest manual-run wording", () => {
    const html = render("Créer une offre Defensive");
    expect(html).toContain("Product Workspace handoff");
    expect(html).toContain("Créer une offre Defensive");
    expect(html).toContain("manual run required");
    expect(html).toContain("not guaranteed");
    expect(html).toContain("Nothing has been run");
  });

  it("renders an honest fallback when no objective is carried", () => {
    const html = render(null);
    expect(html).toContain("Product Workspace handoff");
    expect(html).toContain("No objective carried from the workspace.");
  });

  it("never claims a record was created or a run fired", () => {
    const html = render("Créer une offre Defensive").toLowerCase();
    expect(html).not.toContain("product created");
    expect(html).not.toContain("vault created");
    expect(html).not.toContain("run launched");
    expect(html).not.toContain("investor-ready");
  });

  it("rendering the handoff block triggers NO projection run or promotion", () => {
    render("Créer une offre Defensive");
    render(null);
    expect(mockRunStudy).not.toHaveBeenCalled();
    expect(mockPromote).not.toHaveBeenCalled();
  });
});
