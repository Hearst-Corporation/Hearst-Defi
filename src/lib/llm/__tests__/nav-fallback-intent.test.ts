import { describe, expect, it } from "vitest";

import {
  ADMIN_CUSTOMERS_DESTINATION_KEY,
  ADMIN_OUTREACH_DESTINATION_KEY,
  resolveAdminNavFallbackKey,
  resolveLpNavDestinationKey,
  resolveNavFallbackDestinationKey,
} from "@/lib/llm/nav-fallback-intent";
import { SCENARIO_LAB_DESTINATION_KEY } from "@/lib/llm/product-workspace-intent";

describe("nav-fallback-intent", () => {
  describe("resolveLpNavDestinationKey", () => {
    it("routes explicit LP navigation phrases", () => {
      expect(resolveLpNavDestinationKey("ouvre mon portefeuille")).toBe("portfolio");
      expect(resolveLpNavDestinationKey("voir les produits")).toBe("vaults");
      expect(resolveLpNavDestinationKey("proof center attestations")).toBe(
        "proof-center",
      );
      expect(resolveLpNavDestinationKey("mon profil kyc")).toBe("profile");
    });

    it("returns null for generic product Q&A", () => {
      expect(resolveLpNavDestinationKey("explique le Hearst Yield Vault")).toBeNull();
      expect(resolveLpNavDestinationKey("quel est le lock-up ?")).toBeNull();
    });
  });

  describe("resolveAdminNavFallbackKey", () => {
    it("routes customers and outreach intents", () => {
      expect(resolveAdminNavFallbackKey("créer un nouveau client")).toBe(
        ADMIN_CUSTOMERS_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("ouvre la fiche customer")).toBe(
        ADMIN_CUSTOMERS_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("prépare un email de prospection")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("compose email outreach")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
    });

    it("returns null for unrelated admin ops", () => {
      expect(resolveAdminNavFallbackKey("explique le runbook de déploiement")).toBeNull();
    });
  });

  describe("resolveNavFallbackDestinationKey", () => {
    it("keeps Scenario Lab fallback for admin simulation", () => {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "admin",
          message: "simuler un stress test BTC bear",
          scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
          scenarioLabNavEnabled: true,
        }),
      ).toBe(SCENARIO_LAB_DESTINATION_KEY);
    });

    it("scopes LP profile to LP keys only", () => {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "lp",
          message: "ouvre mon portefeuille",
          scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
          scenarioLabNavEnabled: true,
        }),
      ).toBe("portfolio");

      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "lp",
          message: "créer un nouveau client",
          scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
          scenarioLabNavEnabled: true,
        }),
      ).toBeNull();
    });
  });
});
