import { describe, expect, it } from "vitest";

import {
  PRODUCT_WORKSPACE_DESTINATION_KEY,
  SCENARIO_LAB_DESTINATION_KEY,
  classifyProductWorkspaceIntent,
  deriveProductWorkspaceObjective,
  isExplicitSimulationIntent,
  isProductWorkspaceIntent,
  resolveMasterAgentNavPublish,
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

  it("classifies mixed product creation and simulation as Product Workspace first", () => {
    const classification = classifyProductWorkspaceIntent(
      "Créer un produit Defensive puis simuler un stress test",
    );
    expect(classification).toMatchObject({
      kind: "mixed_product_creation_simulation",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      secondaryDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: true,
      autostart: true,
    });
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

  describe("resolveMasterAgentNavPublish", () => {
    it("overrides model destination for admin product creation intents", () => {
      const directive = resolveMasterAgentNavPublish({
        navProfile: "admin",
        message: "Créer un nouveau produit Defensive",
        modelDestinationKey: "admin-scenario-lab",
        productWorkspaceNavEnabled: true,
      });
      expect(directive).toEqual({
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Créer un nouveau produit Defensive",
        autostart: true,
        intentKind: "product_creation",
      });
    });

    it("preserves Scenario Lab as secondary validation for mixed intents", () => {
      const directive = resolveMasterAgentNavPublish({
        navProfile: "admin",
        message: "Créer un produit Defensive puis simuler un stress test",
        modelDestinationKey: "admin-scenario-lab",
        productWorkspaceNavEnabled: true,
      });
      expect(directive).toEqual({
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Créer un produit Defensive puis simuler un stress test",
        autostart: true,
        intentKind: "mixed_product_creation_simulation",
        secondaryDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
        secondaryHint: "Scenario Lab validation requested",
      });
    });

    it("keeps model destination for explicit simulation requests", () => {
      const directive = resolveMasterAgentNavPublish({
        navProfile: "admin",
        message: "simuler un scénario BTC bear",
        modelDestinationKey: "admin-scenario-lab",
        productWorkspaceNavEnabled: true,
      });
      expect(directive).toEqual({ destinationKey: "admin-scenario-lab" });
    });

    it("does not override LP profile or disabled workspace nav", () => {
      expect(
        resolveMasterAgentNavPublish({
          navProfile: "lp",
          message: "Créer un nouveau produit",
          modelDestinationKey: "portfolio",
          productWorkspaceNavEnabled: true,
        }),
      ).toEqual({ destinationKey: "portfolio" });

      expect(
        resolveMasterAgentNavPublish({
          navProfile: "admin",
          message: "Créer un nouveau produit",
          modelDestinationKey: "admin-vaults",
          productWorkspaceNavEnabled: false,
        }),
      ).toEqual({ destinationKey: "admin-vaults" });
    });
  });
});
