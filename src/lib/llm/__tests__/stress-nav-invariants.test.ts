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
});
