import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    userId: "admin-user",
    role: "admin",
    email: "admin@example.test",
  }),
}));

const mockLoadDraft = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/product-workspace/draft", () => ({
  loadProductWorkspaceDraft: (...args: unknown[]) => mockLoadDraft(...args),
}));

import ProductWorkspacePage from "../page";

async function renderPage(searchParams: {
  autostart?: string;
  objective?: string;
}) {
  const element = await ProductWorkspacePage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

describe("ProductWorkspacePage (near-empty, agent-filled)", () => {
  it("renders only the frame + objective + live brief surface for an agent-seeded page", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    const html = await renderPage({
      autostart: "1",
      objective: "Créer une offre Defensive",
    });

    // Kept: title, objective, agent framing surface, seeded badge.
    expect(html).toContain("Product Workspace");
    expect(html).toContain("Seeded by agent");
    expect(html).toContain("Créer une offre Defensive");
    expect(html).toContain("Agent framing brief");

    // Removed: every pre-computed deterministic artifact.
    expect(html).not.toContain("Calculation notes");
    expect(html).not.toContain("Charts to attach");
    expect(html).not.toContain("Supporting material");
    expect(html).not.toContain("Scenario Outputs");
    expect(html).not.toContain("Next Actions");
    expect(html).not.toContain("Product inference");
    expect(html).not.toContain("Proceed — Draft ready");
  });

  it("renders a persisted brief on refresh when the objective matches", async () => {
    mockLoadDraft.mockResolvedValueOnce({
      objective: "Créer une offre Defensive",
      vaultTicker: "HDV",
      vaultLabel: "Hearst Defensive Vault",
      agentBrief: "Cadrage déjà rédigé par l'agent.",
      scenarioValidationQueued: false,
      updatedAtIso: "2026-06-18T00:00:00.000Z",
    });

    const html = await renderPage({
      objective: "Créer une offre Defensive",
    });

    expect(html).toContain("Cadrage déjà rédigé par l&#x27;agent.");
  });

  it("does NOT render a persisted brief whose objective no longer matches the URL", async () => {
    mockLoadDraft.mockResolvedValueOnce({
      objective: "Un ancien produit",
      vaultTicker: "HYV",
      vaultLabel: "Hearst Yield Vault",
      agentBrief: "Brief de l'ancien produit.",
      scenarioValidationQueued: false,
      updatedAtIso: "2026-06-18T00:00:00.000Z",
    });

    const html = await renderPage({
      objective: "Créer une offre Defensive",
    });

    expect(html).not.toContain("Brief de l'ancien produit.");
  });

  it("shows the awaiting-objective state for a manual (no-objective) entry", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    const html = await renderPage({});

    expect(html).toContain("Manual entry");
    expect(html).toContain("Awaiting objective from cockpit agent");
  });
});
