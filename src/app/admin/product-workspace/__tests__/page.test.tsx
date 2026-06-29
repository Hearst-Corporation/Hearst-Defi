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
  intent?: string;
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

    // Kept: title, objective, agent framing surface.
    // The title is rendered as "Product <span>Workspace</span>" so we check both parts.
    // (Header status badges — "Seeded by agent" / "Manual entry" / HITL — were
    // removed from the page header; no longer asserted.)
    expect(html).toContain("Product");
    expect(html).toContain("Workspace");
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

    // "Manual entry" header badge removed; the awaiting-objective state itself
    // is what matters and is still asserted.
    expect(html).toContain("Awaiting objective from cockpit agent");
  });

  it("renders a Projection CTA carrying the objective + from flag when a SPECIFIC objective exists", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    // A specific objective (asset + yield + risk + horizon) → brief is NOT too
    // vague, so the CTA is the confident "Continue to Projection".
    const objective =
      "BTC yield vault for institutions, 60-day lock-up, downside protection";
    const html = await renderPage({ autostart: "1", objective });

    expect(html).toContain("Next step — Projection");
    expect(html).toContain("Continue to Projection");
    expect(html).toContain(
      `/admin/projection?objective=${encodeURIComponent(objective)}&amp;from=product-workspace`,
    );
    // Honest framing wording is present, forbidden-claim wording is not.
    expect(html).toContain("No run is created from this page");
    expect(html).toContain("manual admin review");
    expect(html.toLowerCase()).not.toContain("product created");
    expect(html.toLowerCase()).not.toContain("vault created");
    expect(html.toLowerCase()).not.toContain("investor-ready");
  });

  it("a VAGUE objective gets an honest 'Continue anyway' CTA with a no-prefill note", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    // "Créer une offre Defensive" carries almost no substance → too vague.
    const html = await renderPage({
      autostart: "1",
      objective: "Créer une offre Defensive",
    });

    expect(html).toContain("Continue anyway");
    expect(html).toContain(
      "Projection will require manual assumptions. No numbers will be prefilled.",
    );
    // Still a real link (not disabled) — the admin may proceed manually.
    expect(html).toContain("/admin/projection?objective=");
  });

  it("shows the routing-source block (deterministic, no LLM) when seeded by chat", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    const html = await renderPage({
      autostart: "1",
      objective: "BTC yield vault, 60-day lock-up, downside protection",
      intent: "product_creation",
    });

    expect(html).toContain("Routing source");
    expect(html).toContain("deterministic product intent");
    expect(html).toContain("no LLM used to route");
    expect(html).toContain("cockpit chat");
  });

  it("disables the Projection CTA with an honest message when no objective was received", async () => {
    mockLoadDraft.mockResolvedValueOnce(null);
    const html = await renderPage({});

    expect(html).toContain("Continue to Projection — objective required");
    expect(html).toContain('aria-disabled="true"');
    // No live link to projection when there is nothing to carry.
    expect(html).not.toContain("/admin/projection?objective=");
  });
});
