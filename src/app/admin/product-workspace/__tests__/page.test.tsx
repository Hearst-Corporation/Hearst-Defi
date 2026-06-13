import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    userId: "admin-user",
    role: "admin",
    email: "admin@example.test",
  }),
}));

vi.mock("@/lib/product-workspace/draft", () => ({
  loadProductWorkspaceDraft: vi.fn().mockResolvedValue(null),
  upsertProductWorkspaceDraft: vi.fn().mockResolvedValue({
    objective: "Créer une offre Defensive avec notes de calcul",
    vaultTicker: "HDV",
    vaultLabel: "Hearst Defensive Vault",
    scenarioValidationQueued: false,
    updatedAtIso: "2026-06-13T01:02:03.000Z",
  }),
}));

import ProductWorkspacePage from "../page";
import { upsertProductWorkspaceDraft } from "@/lib/product-workspace/draft";

async function renderPage(searchParams: {
  autostart?: string;
  objective?: string;
  intent?: string;
  secondary?: string;
  secondaryHint?: string;
}) {
  const element = await ProductWorkspacePage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

describe("ProductWorkspacePage", () => {
  it("renders an agent-seeded independent product workspace", async () => {
    const html = await renderPage({
      autostart: "1",
      objective: "Créer une offre Defensive avec notes de calcul",
    });

    expect(html).toContain("Product Workspace");
    expect(html).toContain("Seeded by agent");
    expect(html).toContain("Créer une offre Defensive avec notes de calcul");
    expect(html).toContain("Proceed — Draft ready");
    expect(html).toContain("Hearst Defensive Vault");
    expect(html).toContain("5-8%");
    expect(html).toContain("Calculation Notes");
    expect(html).toContain("Charts to attach");
    expect(html).toContain("Estimated visuals");
    expect(html).toContain("Saved draft");
    expect(html).toContain("Assumptions");
    expect(html).toContain("Scenario Outputs");
    expect(html).toContain("Next Actions");
    expect(html).toContain("Conditional projection — not a committed outcome");
    expect(html).toContain("Scenario Lab stress-tests");
    expect(upsertProductWorkspaceDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-user",
        objective: "Créer une offre Defensive avec notes de calcul",
        vaultTicker: "HDV",
      }),
    );
  });

  it("infers BTC Plus and adapts chart/calculation artifacts", async () => {
    const html = await renderPage({
      autostart: "1",
      objective: "Frame a BTC Plus product workspace with graphs",
    });

    expect(html).toContain("Hearst BTC Plus Vault");
    expect(html).toContain("10-20%");
    expect(html).toContain("BTC tactical 45%");
    expect(html).toContain("HBP target mix");
    expect(html).toContain("Target weights");
    expect(html).toContain("10-20% target APY range");
  });

  it("keeps Scenario Lab as supporting evidence when scenario outputs are requested", async () => {
    const html = await renderPage({
      autostart: "1",
      objective: "Créer un produit Defensive puis simuler un stress test",
    });

    expect(html).toContain("Scenario validation requested");
    expect(html).toContain("supporting evidence only");
    expect(html).toContain("Return APY range");
  });

  it("renders a secondary Scenario Lab action for mixed agent intents", async () => {
    const html = await renderPage({
      autostart: "1",
      objective: "Créer un produit Defensive puis simuler un stress test",
      intent: "mixed_product_creation_simulation",
      secondary: "scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
    });

    expect(html).toContain("Scenario validation queued");
    expect(html).toContain("Scenario validation");
    expect(html).toContain("Scenario Lab validation requested");
    expect(html).toContain("Open Scenario Lab");
    expect(html).toContain(
      "/admin/scenario-lab?autostart=1&amp;objective=Cr%C3%A9er+un+produit+Defensive+puis+simuler+un+stress+test",
    );
  });

  it("holds manual workspaces and rejects out-of-mandate objectives", async () => {
    const manualHtml = await renderPage({});
    expect(manualHtml).toContain("Manual entry");
    expect(manualHtml).toContain("Hold — Evidence gap");

    const rejectHtml = await renderPage({
      autostart: "1",
      objective: "Create a retail product with no KYC and fixed yield",
    });
    expect(rejectHtml).toContain("Reject — Out of mandate");
  });
});
