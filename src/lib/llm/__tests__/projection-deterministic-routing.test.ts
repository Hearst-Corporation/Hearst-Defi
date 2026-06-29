import { describe, expect, it } from "vitest";

import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";

/**
 * A projection ask must route DETERMINISTICALLY to the Scenario Lab — never the
 * Product Workspace, and never fall to the LLM. This closes the "Je veux faire
 * une projection." gap (previously unknown → LLM fallback).
 */
describe("projection → deterministic Scenario Lab", () => {
  it.each([
    "Je veux faire une projection.",
    "I want to run a projection",
    "fais une projection sur ce vault",
    "génère une prévision de rendement",
  ])('"%s" opens the Scenario Lab', (msg) => {
    const c = classifyProductWorkspaceIntent(msg);
    expect(c.shouldOpenScenarioLab).toBe(true);
    expect(c.shouldOpenProductWorkspace).toBe(false);
  });

  it('"create projection" still does NOT open the Product Workspace (regression guard)', () => {
    const c = classifyProductWorkspaceIntent("create projection");
    expect(c.shouldOpenProductWorkspace).toBe(false);
    // It is allowed to open the Scenario Lab (a projection is a simulation).
    expect(c.shouldOpenScenarioLab).toBe(true);
  });

  it("a real product creation is untouched by the projection change", () => {
    const c = classifyProductWorkspaceIntent(
      "Je veux créer un produit de rendement BTC",
    );
    expect(c.shouldOpenProductWorkspace).toBe(true);
  });
});
