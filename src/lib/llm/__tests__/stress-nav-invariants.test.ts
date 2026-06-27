import { describe, expect, it } from "vitest";

import {
  resolveAdminNavFallbackKey,
  resolveLpNavDestinationKey,
} from "@/lib/llm/nav-fallback-intent";

/**
 * Targeted regex-resolver invariants the cartesian stress corpus does NOT cover.
 *
 * `stress-nav-corpus.test.ts` brute-forces (verb x keyword) pairs and checks
 * determinism + no false positives, but it never asserts the *ordering* /
 * boundary / gating guarantees the resolver relies on:
 *
 *   1. depth-priority — a sub-page beats its parent (derived rules sorted by
 *      route depth so "/portfolio/tax" wins over "/portfolio").
 *   2. hand-tuned-first — bespoke LP_NAV_RULES run before the derived path
 *      (proved with verb-less phrases that only a hand-tuned, non-verb-gated
 *      alternation can match).
 *   3. accented-letter boundary — the `\p{L}` Unicode lookarounds (NOT ASCII
 *      `\b`) correctly bound keywords ending in "é" (sécurité / fiscalité /
 *      activité).
 *   4. verb-gating — a bare keyword with no nav verb must NOT navigate, so a
 *      conversational mention can't hijack navigation (P0 if it does).
 *
 * Pure regex, no LLM, no I/O. All expected keys were grounded against the real
 * resolver output before being asserted here.
 */
describe("nav-fallback resolver — depth-priority / hand-tuned / accent / verb-gating invariants", () => {
  // ---- 1. Sub-page beats parent -------------------------------------------
  describe("depth-priority: a sub-page wins over its parent", () => {
    it('"ouvre mes distributions" → portfolio-distributions (NOT portfolio)', () => {
      const key = resolveLpNavDestinationKey("ouvre mes distributions");
      expect(key).toBe("portfolio-distributions");
      expect(key).not.toBe("portfolio");
    });

    it('"va sur ma fiscalité" → portfolio-tax (NOT portfolio)', () => {
      const key = resolveLpNavDestinationKey("va sur ma fiscalité");
      expect(key).toBe("portfolio-tax");
      expect(key).not.toBe("portfolio");
    });

    it('"montre-moi mes positions" → portfolio-positions (NOT portfolio)', () => {
      const key = resolveLpNavDestinationKey("montre-moi mes positions");
      expect(key).toBe("portfolio-positions");
      expect(key).not.toBe("portfolio");
    });
  });

  // ---- 2. Hand-tuned rules run first --------------------------------------
  describe("hand-tuned rules run before the derived path", () => {
    it('"ouvre mon portefeuille" → portfolio', () => {
      expect(resolveLpNavDestinationKey("ouvre mon portefeuille")).toBe(
        "portfolio",
      );
    });

    // The derived path is nav-verb-gated; only a hand-tuned (non-verb-gated)
    // alternation can resolve these verb-less phrases. Their resolution is the
    // proof that the hand-tuned rules run first/independently.
    it('verb-less "mon portefeuille" still → portfolio (hand-tuned only)', () => {
      expect(resolveLpNavDestinationKey("mon portefeuille")).toBe("portfolio");
    });

    it('verb-less "souscrire" → vaults (hand-tuned alternation, not derived)', () => {
      expect(resolveLpNavDestinationKey("souscrire")).toBe("vaults");
    });

    it('verb-less "subscribe" → vaults (hand-tuned alternation, not derived)', () => {
      expect(resolveLpNavDestinationKey("subscribe")).toBe("vaults");
    });

    it('verb-less "mon profil" → profile (hand-tuned alternation, not derived)', () => {
      expect(resolveLpNavDestinationKey("mon profil")).toBe("profile");
    });
  });

  // ---- 3. Accented-letter boundary (the \p{L} lookaround fix) -------------
  describe("accented-letter boundary: keywords ending in é resolve", () => {
    it('"va sur ma sécurité" → admin-security (admin resolver)', () => {
      expect(resolveAdminNavFallbackKey("va sur ma sécurité")).toBe(
        "admin-security",
      );
    });

    it('"ouvre ma fiscalité" → portfolio-tax (LP resolver)', () => {
      expect(resolveLpNavDestinationKey("ouvre ma fiscalité")).toBe(
        "portfolio-tax",
      );
    });

    it('"montre-moi l\'activité" → portfolio-activity (apostrophe + trailing é)', () => {
      expect(resolveLpNavDestinationKey("montre-moi l'activité")).toBe(
        "portfolio-activity",
      );
    });
  });

  // ---- 4. Verb-gating: bare keyword (no verb) must NOT navigate -----------
  describe("verb-gating: a bare keyword with no nav verb returns null", () => {
    const bareKeywords = ["distributions", "fiscalité", "portfolio"] as const;

    for (const word of bareKeywords) {
      it(`"${word}" (no verb) → null on BOTH resolvers (conversational mention must not navigate)`, () => {
        expect(resolveLpNavDestinationKey(word)).toBeNull();
        expect(resolveAdminNavFallbackKey(word)).toBeNull();
      });
    }
  });

  // ---- 5. False positives the broadened router (#117) reintroduced --------
  // These regressed after the global nav hardening: a bare mention, a question,
  // or a bug report started navigating. Each MUST stay non-navigating on BOTH
  // resolvers. (Restored verb-gating; bare correctly-spelled nouns excluded.)
  describe("conversational mentions / questions / bug reports never navigate", () => {
    const mustNotNavigate = [
      // bare mention of a destination noun
      "portfolio",
      "proof center",
      // explanation / question phrasings
      "peux-tu m'expliquer la preuve de réserve",
      "explique-moi mon portfolio",
      "what is proof of reserves",
      "tell me about vaults",
      "j'ai une question sur les campagnes",
      // bug reports — never a navigation intent
      "le dashboard est cassé",
      "portfolio value is wrong",
    ] as const;

    for (const phrase of mustNotNavigate) {
      it(`"${phrase}" → null on BOTH resolvers`, () => {
        expect(resolveLpNavDestinationKey(phrase)).toBeNull();
        expect(resolveAdminNavFallbackKey(phrase)).toBeNull();
      });
    }
  });

  // ---- 6. Explicit navigation intents that MUST still resolve -------------
  // The verb-gating tightening must NOT regress genuine navigation. Each pair is
  // [phrase, expected LP key]. Typo-as-command ("portofolio", "dashbord") is an
  // explicit short command and DOES navigate; the correctly-spelled bare noun
  // does not (covered above).
  describe("explicit navigation intents still resolve (LP)", () => {
    const lpNav: Array<[string, string]> = [
      ["ouvre dashboard", "portfolio"],
      ["amène-moi au dashboard", "portfolio"],
      ["open my portfolio", "portfolio"],
      ["show distributions", "portfolio-distributions"],
      ["va sur proof center", "proof-center"],
      ["portofolio", "portfolio"], // typo command
      ["dashbord", "portfolio"], // typo command
    ];
    for (const [phrase, key] of lpNav) {
      it(`"${phrase}" → ${key}`, () => {
        expect(resolveLpNavDestinationKey(phrase)).toBe(key);
      });
    }
  });

  describe("explicit navigation intents still resolve (admin)", () => {
    const adminNav: Array<[string, string]> = [
      ["ouvre scenario lab", "admin-scenario-lab"],
      ["open outreach", "admin-outreach"],
      ["scenarion lab", "admin-scenario-lab"], // typo command
    ];
    for (const [phrase, key] of adminNav) {
      it(`"${phrase}" → ${key}`, () => {
        expect(resolveAdminNavFallbackKey(phrase)).toBe(key);
      });
    }
  });

  // ---- 7. Determinism: same input N times = same destination -------------
  // The pure resolvers must be referentially transparent. Running each phrase 10
  // times in a row must yield the identical result every time (no regex lastIndex
  // leak, no module-level mutable state, no ordering instability).
  describe("same input 10 times = same destination", () => {
    const phrases = [
      "ouvre dashboard",
      "show distributions",
      "va sur proof center",
      "open outreach",
      "scenarion lab",
      "portfolio", // null, must stay null
      "le dashboard est cassé", // null, must stay null
    ] as const;

    for (const phrase of phrases) {
      it(`"${phrase}" is stable across 10 LP + 10 admin calls`, () => {
        const lp0 = resolveLpNavDestinationKey(phrase);
        const admin0 = resolveAdminNavFallbackKey(phrase);
        for (let i = 0; i < 10; i++) {
          expect(resolveLpNavDestinationKey(phrase)).toBe(lp0);
          expect(resolveAdminNavFallbackKey(phrase)).toBe(admin0);
        }
      });
    }
  });
});
