import { describe, expect, it } from "vitest";

import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";

/**
 * The Scenario Lab route was RETIRED, so a standalone projection/simulation ask no
 * longer routes to a deterministic destination — it must NOT open the Product
 * Workspace (no product noun), carries no scenario-lab destination, and falls
 * through to the LLM. This guards against re-introducing dead-route navigation.
 */
describe("projection → falls to the LLM (Scenario Lab retired)", () => {
  it.each([
    "Je veux faire une projection.",
    "I want to run a projection",
    "fais une projection sur ce vault",
    "génère une prévision de rendement",
  ])('"%s" does not open the Product Workspace and carries no scenario-lab destination', (msg) => {
    const c = classifyProductWorkspaceIntent(msg);
    expect(c.shouldOpenProductWorkspace).toBe(false);
    expect(c.primaryDestinationKey).toBeUndefined();
    expect(c).not.toHaveProperty("secondaryDestinationKey");
    expect(c).not.toHaveProperty("shouldOpenScenarioLab");
  });

  it('"create projection" still does NOT open the Product Workspace (regression guard)', () => {
    const c = classifyProductWorkspaceIntent("create projection");
    expect(c.shouldOpenProductWorkspace).toBe(false);
    // A bare projection ask no longer opens a deterministic destination either.
    expect(c.primaryDestinationKey).toBeUndefined();
  });

  it("a real product creation is untouched by the projection change", () => {
    const c = classifyProductWorkspaceIntent(
      "Je veux créer un produit de rendement BTC",
    );
    expect(c.shouldOpenProductWorkspace).toBe(true);
  });
});
