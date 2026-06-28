import { describe, expect, it } from "vitest";

import {
  ADMIN_CUSTOMERS_DESTINATION_KEY,
  ADMIN_OUTREACH_DESTINATION_KEY,
  NAV_REJECT_ACK,
  NAV_SHORTCUT_ACK,
  buildNavRejectAck,
  buildNavShortcutAck,
  looksLikeNavIntent,
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
      expect(resolveLpNavDestinationKey("open my dashboard")).toBe("portfolio");
      // Portfolio sub-leaves were removed from the chat whitelist (unwired stubs):
      // an explicit nav phrase for them now resolves nothing (no blank-page routing).
      expect(resolveLpNavDestinationKey("open activity")).toBeNull();
      expect(resolveLpNavDestinationKey("open distributions")).toBeNull();
      expect(resolveLpNavDestinationKey("open yield")).toBeNull();
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
      expect(resolveAdminNavFallbackKey("show campaigns")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("open scenario lab")).toBe(
        SCENARIO_LAB_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("go to projection")).toBe("admin-projection");
      expect(resolveAdminNavFallbackKey("open control tower")).toBe("admin-home");
      expect(resolveAdminNavFallbackKey("va sur le dashboard admin")).toBe(
        "admin-dashboard",
      );
    });

    it("accepts mixed-language and typo variants", () => {
      expect(resolveAdminNavFallbackKey("ouvre dashboard")).toBe("admin-dashboard");
      expect(resolveAdminNavFallbackKey("va proof center")).toBe("admin-proof-center");
      expect(resolveAdminNavFallbackKey("show la campagne")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("ouvri le dashboard")).toBe("admin-dashboard");
      expect(resolveAdminNavFallbackKey("dashbord admin")).toBe("admin-dashboard");
      expect(resolveAdminNavFallbackKey("campain outreach")).toBe(
        ADMIN_OUTREACH_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("scenarion lab")).toBe(
        SCENARIO_LAB_DESTINATION_KEY,
      );
      expect(resolveAdminNavFallbackKey("projetion admin")).toBe("admin-projection");
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

  // ---------------------------------------------------------------------------
  // looksLikeNavIntent — deny-first pipeline
  // ---------------------------------------------------------------------------
  describe("looksLikeNavIntent", () => {
    // TRUE: genuine navigation attempts that should get the instant reject
    it("returns true for explicit nav phrases pointing at unknown destinations", () => {
      expect(looksLikeNavIntent("ouvre la page xyz")).toBe(true);
      expect(looksLikeNavIntent("va sur la section truc")).toBe(true);
      expect(looksLikeNavIntent("montre-moi le machin introuvable")).toBe(true);
      expect(looksLikeNavIntent("open the gizmo page")).toBe(true);
    });

    // TRUE: accented verbs / variants
    it("normalises accents before matching nav verbs", () => {
      expect(looksLikeNavIntent("amène-moi sur la page foo")).toBe(true);
      expect(looksLikeNavIntent("affiche-moi le truc inconnu")).toBe(true);
    });

    // FALSE — QUESTION guard
    it("returns false for messages starting with a question word (falls to LLM)", () => {
      expect(looksLikeNavIntent("comment ouvrir un compte ?")).toBe(false);
      expect(looksLikeNavIntent("pourquoi le yield est bas")).toBe(false);
      expect(looksLikeNavIntent("what is the lock-up period")).toBe(false);
      expect(looksLikeNavIntent("how do I open the vaults")).toBe(false);
    });

    // FALSE — ACTION_VERB guard
    it("returns false for messages that start with a mutating action verb", () => {
      expect(looksLikeNavIntent("crée un nouveau vault")).toBe(false);
      expect(looksLikeNavIntent("envoie un email de confirmation")).toBe(false);
      expect(looksLikeNavIntent("supprime cet investisseur")).toBe(false);
      expect(looksLikeNavIntent("generate a report")).toBe(false);
    });

    // FALSE — NEGATION guard
    it("returns false when a negation marker is present", () => {
      expect(looksLikeNavIntent("je ne veux pas ouvrir ça")).toBe(false);
      expect(looksLikeNavIntent("don't open the settings")).toBe(false);
      expect(looksLikeNavIntent("sans ouvrir la page")).toBe(false);
    });

    // FALSE — CONJUNCTION guard (compound command)
    it("returns false for compound commands containing a conjunction", () => {
      expect(looksLikeNavIntent("ouvre X et supprime Y")).toBe(false);
      expect(looksLikeNavIntent("go to vaults and then export")).toBe(false);
    });

    // FALSE — TOPIC guard (no nav-verb lead, explanatory intent)
    it("returns false when a topic marker signals an explanation request (no nav-verb lead)", () => {
      // "explique" is not a nav verb, and "sur" triggers TOPIC_GUARD
      expect(looksLikeNavIntent("explique sur la fiscalité")).toBe(false);
      expect(looksLikeNavIntent("infos about the lockup")).toBe(false);
    });

    // FALSE — LENGTH guard
    it("returns false for a long sentence even when starting with a nav verb", () => {
      // This phrase is >58 chars normalized
      const longPhrase =
        "ouvre la documentation complète sur la stratégie de yield mining et les distributions";
      expect(looksLikeNavIntent(longPhrase)).toBe(false);
    });

    // FALSE — bare keyword / too few useful words without a nav verb, but topic-free and short:
    // "distributions" alone is ≤1 useful word → would be TRUE unless we decide otherwise.
    // Per spec: ≤3 useful words without nav-verb-lead still passes eligibility.
    // But "explique le lock-up" has an action verb "explique" that is not in the
    // ACTION_VERB list — it still has 3 useful words and no nav verb → true? Let's
    // verify: it has no nav verb, no question word, no negation, no conjunction,
    // no topic guard trigger, length < 36 ("explique le lock up" = 18 chars). So it
    // WOULD be true. This is fine — the test below verifies the real falsy cases.
    it("returns false for an explanatory phrase even without a nav verb (via length or topic)", () => {
      // >36 chars, no nav verb → length guard fires
      expect(
        looksLikeNavIntent(
          "explique-moi en detail comment fonctionne le lock-up de 60 jours",
        ),
      ).toBe(false);
    });

    // FALSE — empty / whitespace
    it("returns false for empty or whitespace-only input", () => {
      expect(looksLikeNavIntent("")).toBe(false);
      expect(looksLikeNavIntent("   ")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // NAV_REJECT_ACK — compliance / forbidden-words check
  // ---------------------------------------------------------------------------
  describe("NAV_REJECT_ACK", () => {
    it("is a non-empty string", () => {
      expect(typeof NAV_REJECT_ACK).toBe("string");
      expect(NAV_REJECT_ACK.length).toBeGreaterThan(0);
    });

    it("does not contain forbidden financial words", () => {
      const forbidden = [
        "guarantee",
        "promise",
        "certain",
        "will deliver",
        "risk-free",
        "APY",
        "%",
      ];
      for (const word of forbidden) {
        expect(NAV_REJECT_ACK.toLowerCase()).not.toContain(word.toLowerCase());
      }
    });
  });

  describe("language-aware nav acknowledgements", () => {
    it("returns French ack for French messages", () => {
      expect(buildNavShortcutAck("ouvre mon portefeuille")).toBe(NAV_SHORTCUT_ACK);
      expect(buildNavRejectAck("ouvre la lune")).toBe(NAV_REJECT_ACK);
    });

    it("returns English ack for English messages", () => {
      expect(buildNavShortcutAck("open my portfolio")).toBe("Taking you there.");
      expect(buildNavRejectAck("open the moon page")).toBe(
        "I can't find that section in your workspace. Can I help with something else?",
      );
    });
  });
});
