import { describe, expect, it } from "vitest";

import {
  ADMIN_CUSTOMERS_DESTINATION_KEY,
  ADMIN_OUTREACH_DESTINATION_KEY,
  NAV_SHORTCUT_ACK,
  resolveAdminNavFallbackKey,
  resolveLpNavDestinationKey,
  resolveNavFallbackDestinationKey,
} from "@/lib/llm/nav-fallback-intent";
import { SCENARIO_LAB_DESTINATION_KEY } from "@/lib/llm/product-workspace-intent";

describe("nav-fallback-intent", () => {
  it("exposes a short navigation ack", () => {
    expect(NAV_SHORTCUT_ACK).toBe("Je vous y emmène.");
  });

  describe("resolveLpNavDestinationKey", () => {
    it("routes explicit LP navigation phrases", () => {
      expect(resolveLpNavDestinationKey("ouvre mon portefeuille")).toBe("portfolio");
      expect(resolveLpNavDestinationKey("voir les produits")).toBe("vaults");
      expect(resolveLpNavDestinationKey("proof center attestations")).toBe(
        "proof-center",
      );
      expect(resolveLpNavDestinationKey("mon profil kyc")).toBe("profile");
      expect(resolveLpNavDestinationKey("amène-moi sur les vaults")).toBe("vaults");
    });

    it("routes English navigation verbs symmetrically (EN/FR parity)", () => {
      expect(resolveLpNavDestinationKey("go to portfolio")).toBe("portfolio");
      expect(resolveLpNavDestinationKey("show portfolio")).toBe("portfolio");
      expect(resolveLpNavDestinationKey("show vaults")).toBe("vaults");
      expect(resolveLpNavDestinationKey("open proof center")).toBe("proof-center");
    });

    it("returns null for generic product Q&A", () => {
      expect(resolveLpNavDestinationKey("explique le Hearst Yield Vault")).toBeNull();
      expect(resolveLpNavDestinationKey("quel est le lock-up ?")).toBeNull();
      // "show"/"view" as a verb must not turn Q&A into navigation
      expect(resolveLpNavDestinationKey("show me the APY range")).toBeNull();
      expect(resolveLpNavDestinationKey("what is the vault structure")).toBeNull();
    });

    it("never routes sensitive mutating intents to a navigation destination", () => {
      // These must fall through to the LLM, which refuses — they are NOT navigation.
      for (const msg of [
        "withdraw my funds",
        "retirer mes fonds",
        "start investing",
        "invest 250000 now",
        "send payout",
        "envoie un paiement",
        "execute a distribution",
        "exécute une distribution",
        "send an email to all investors",
      ]) {
        expect(resolveLpNavDestinationKey(msg)).toBeNull();
      }
    });
  });

  describe("resolveAdminNavFallbackKey", () => {
    it("routes customers, user portfolio and outreach intents", () => {
      expect(resolveAdminNavFallbackKey("créer un nouveau client")).toBe(
        ADMIN_CUSTOMERS_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("ouvre la fiche customer")).toBe(
        ADMIN_CUSTOMERS_DESTINATION_KEY,
      );
      expect(
        resolveAdminNavFallbackKey("ouvre le portefeuille utilisateur"),
      ).toBe(ADMIN_CUSTOMERS_DESTINATION_KEY);
      expect(resolveAdminNavFallbackKey("prépare un email de prospection")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("compose email outreach")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("va sur le dashboard admin")).toBe(
        "admin-dashboard",
      );
    });

    it("returns null for unrelated admin ops", () => {
      expect(resolveAdminNavFallbackKey("explique le runbook de déploiement")).toBeNull();
    });

    it("never routes sensitive admin actions to a navigation destination", () => {
      // Payout / distribution / governance approval / deploy are NOT navigation —
      // they must fall through to the LLM, which has no tool to execute them.
      for (const msg of [
        "send payout to investor",
        "execute distribution",
        "approuve la proposition de gouvernance",
        "deploy the vault contract",
        "signe la transaction",
      ]) {
        expect(resolveAdminNavFallbackKey(msg)).toBeNull();
      }
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
          isAdmin: false,
          message: "créer un nouveau client",
          scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
          scenarioLabNavEnabled: true,
        }),
      ).toBeNull();
    });

    it("routes admin shortcuts for admins even in normal (lp) chat mode", () => {
      expect(
        resolveNavFallbackDestinationKey({
          navProfile: "lp",
          isAdmin: true,
          message: "montre le portefeuille client",
          scenarioLabDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
          scenarioLabNavEnabled: true,
        }),
      ).toBe(ADMIN_CUSTOMERS_DESTINATION_KEY);
    });
  });
});
