import { describe, expect, it } from "vitest";

import {
  PRODUCT_WORKSPACE_DESTINATION_KEY,
  classifyProductWorkspaceIntent,
  deriveProductWorkspaceObjective,
  isExplicitSimulationIntent,
  isProductWorkspaceIntent,
} from "@/lib/llm/product-workspace-intent";

describe("product workspace intent", () => {
  it("routes product creation and new vault framing to Product Workspace", () => {
    expect(PRODUCT_WORKSPACE_DESTINATION_KEY).toBe("admin-product-workspace");
    expect(isProductWorkspaceIntent("Créer un nouveau produit Defensive")).toBe(true);
    expect(isProductWorkspaceIntent("new vault for BTC Plus go-to-market")).toBe(true);
    expect(isProductWorkspaceIntent("cadrer une stratégie produit institutionnelle")).toBe(
      true,
    );
  });

  it("keeps explicit simulation and scenario requests out of product creation routing", () => {
    expect(isProductWorkspaceIntent("simuler un scénario BTC bear")).toBe(false);
    expect(isProductWorkspaceIntent("run scenario for HYV drawdown")).toBe(false);
    expect(isProductWorkspaceIntent("Monte Carlo sur le vault defensif")).toBe(false);
  });

  it("classifies explicit simulation phrases in French and English", () => {
    expect(isExplicitSimulationIntent("simuler un scénario")).toBe(true);
    expect(isExplicitSimulationIntent("run scenario for HYV")).toBe(true);
    expect(isExplicitSimulationIntent("Monte Carlo sur BTC Plus")).toBe(true);
    expect(isExplicitSimulationIntent("backtest Defensive")).toBe(true);
    expect(isExplicitSimulationIntent("cadrer une stratégie produit")).toBe(false);
  });

  it("classifies mixed product creation and simulation as Product Workspace (no dead Scenario Lab secondary)", () => {
    // The Scenario Lab route was retired: a mixed product+simulation intent still
    // opens the Product Workspace, and the simulation half is recorded only in the
    // `kind` — there is no `secondaryDestinationKey`/`shouldOpenScenarioLab`.
    const classification = classifyProductWorkspaceIntent(
      "Créer un produit Defensive puis simuler un stress test",
    );
    expect(classification).toMatchObject({
      kind: "mixed_product_creation_simulation",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      shouldOpenProductWorkspace: true,
      autostart: true,
    });
    expect(classification).not.toHaveProperty("secondaryDestinationKey");
    expect(classification).not.toHaveProperty("shouldOpenScenarioLab");
    expect(isProductWorkspaceIntent("Créer un produit Defensive puis simuler un stress test")).toBe(
      true,
    );
    expect(isExplicitSimulationIntent("Créer un produit Defensive puis simuler un stress test")).toBe(
      true,
    );
  });

  it("derives a bounded objective for the workspace query string", () => {
    const objective = deriveProductWorkspaceObjective(`  créer   un    produit ${"x".repeat(300)}`);
    expect(objective).toHaveLength(220);
    expect(objective).toMatch(/^créer un produit/);
  });
});

// ── P0 stress suite — assistant navigation intent (vault / product workspace) ──
// Every "claire intention" phrase must open the canonical Product Workspace
// (admin-product-workspace). Negatives (electrical/math/css/bare-question) must
// NOT. Navigation stays 100% deterministic — these are pure regex assertions.
describe("product workspace intent — P0 navigation stress suite", () => {
  // The exact failing logs from the bug report — these MUST navigate now.
  const REGRESSION_LOGS = [
    "Va faire un volt",
    "go vault creation",
    "On va faire un vault",
    "Va créer un produit.",
    "Va créer dans le workspace.",
  ];

  // 20 FR
  const FR = [
    "va faire un vault",
    "faire un vault",
    "on va faire un vault",
    "créer un vault",
    "crée un vault",
    "créer un produit",
    "crée un produit",
    "lancer un produit",
    "construire un produit",
    "monter un produit",
    "créer dans le workspace",
    "va créer dans le workspace",
    "aller dans le workspace",
    "ouvre le workspace",
    "ouvrir le workspace produit",
    "workspace produit",
    "création produit",
    "construction produit",
    "démarre un nouveau vault",
    "structurer un produit defensive",
  ];

  // 15 EN
  const EN = [
    "go vault creation",
    "open vault creation",
    "create vault",
    "create a vault",
    "new vault",
    "launch product",
    "create product",
    "build a product",
    "open product workspace",
    "go product workspace",
    "product construction",
    "product creation",
    "new product",
    "construction workspace",
    "go to market with a new vault",
  ];

  // 10 typos (in a creation / nav context — bare ambiguous tokens are covered separately)
  const TYPOS = [
    "faire un volt",
    "crée un vaut",
    "créer un vaul",
    "construire un veault",
    "monter un vaultt",
    "go vaut creation",
    "new volt",
    "create a vaul",
    "faire un vautl",
    "va faire un volt",
  ];

  // 5 mixed-language
  const MIXED = [
    "créer a new vault",
    "go faire un vault",
    "open le workspace produit",
    "lance a product workspace",
    "crée a product",
  ];

  it.each([...REGRESSION_LOGS, ...FR, ...EN, ...TYPOS, ...MIXED])(
    "navigates to Product Workspace: %s",
    (phrase) => {
      const c = classifyProductWorkspaceIntent(phrase);
      expect(c.shouldOpenProductWorkspace).toBe(true);
      expect(c.primaryDestinationKey).toBe(PRODUCT_WORKSPACE_DESTINATION_KEY);
    },
  );

  // Negatives — clear non-navigation / non-product intents must NOT route.
  const NEGATIVES = [
    "explique moi ce qu'est un volt",
    "quelle est la tension en volts",
    "voltage bitcoin mining",
    "workspace CSS bug",
    "produit scalaire math",
    "comment créer un bon mot de passe",
    "fais le rapport",
    "explain what a vault is",
    "what is the voltage of the miner",
    "le produit scalaire de deux vecteurs",
  ];

  it.each(NEGATIVES)("does NOT navigate: %s", (phrase) => {
    expect(isProductWorkspaceIntent(phrase)).toBe(false);
  });
});
