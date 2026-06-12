import { describe, expect, it } from "vitest";

import {
  PRODUCT_WORKSPACE_DESTINATION_KEY,
  deriveProductWorkspaceObjective,
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
