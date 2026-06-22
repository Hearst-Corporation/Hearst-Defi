import { describe, expect, it } from "vitest";

import {
  resolveClientNav,
  NAV_SHORTCUT_ACK,
  NAV_REJECT_ACK,
} from "@/lib/llm/client-nav";
import { LP_NAV_DESTINATIONS } from "@/lib/llm/navigate-tool";

const LP_ROUTES = new Set(LP_NAV_DESTINATIONS.map((d) => d.route));

describe("resolveClientNav (client fast-path classifier)", () => {
  it("re-exports the compliance-clean ack strings", () => {
    expect(NAV_SHORTCUT_ACK).toBe("Je vous y emmène.");
    expect(NAV_REJECT_ACK.length).toBeGreaterThan(0);
    // Compliance: the ack/reject strings carry none of the forbidden words.
    for (const ack of [NAV_SHORTCUT_ACK, NAV_REJECT_ACK]) {
      for (const forbidden of [
        "guarantee",
        "promise",
        "certain",
        "will deliver",
        "risk-free",
      ]) {
        expect(ack.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  describe("kind: nav — resolves an LP destination and navigates locally", () => {
    it("routes explicit LP navigation phrases to their real route", () => {
      const cases: Array<[string, string]> = [
        ["ouvre mon portefeuille", "/portfolio"],
        ["voir les produits", "/vaults"],
        ["open proof center", "/proof-center"],
        ["go to portfolio", "/portfolio"],
        ["mon profil kyc", "/profile"],
      ];
      for (const [message, route] of cases) {
        const result = resolveClientNav(message);
        expect(result.kind).toBe("nav");
        expect(result.route).toBe(route);
        expect(result.ack).toBe(NAV_SHORTCUT_ACK);
        expect(result.label).toBeTruthy();
        // The resolved route must be a real whitelisted LP destination.
        expect(LP_ROUTES.has(result.route ?? "")).toBe(true);
      }
    });
  });

  describe("kind: chat — a real question NEVER short-circuits", () => {
    it("falls through to the server for product Q&A (no nav verb, no destination)", () => {
      // These carry NO leading navigation verb, so they are neither a
      // destination match nor a nav-reject gesture → they must POST.
      for (const message of [
        "explique le Hearst Yield Vault",
        "quel est le lock-up ?",
        "what is the vault structure",
        "comment fonctionne le rendement ?",
      ]) {
        expect(resolveClientNav(message).kind).toBe("chat");
      }
    });

    it("treats a nav-verb gesture with no destination as a local reject (server parity)", () => {
      // "show me the APY range" leads with the nav verb "show me" but resolves no
      // page → the SERVER itself emits NAV_REJECT_ACK via looksLikeNavIntent, so
      // the client mirrors that exactly (zero network) instead of POSTing.
      const result = resolveClientNav("show me the APY range");
      expect(result.kind).toBe("reject");
      expect(result.ack).toBe(NAV_REJECT_ACK);
    });

    it("never routes sensitive mutating intents (they reach the LLM, which refuses)", () => {
      for (const message of [
        "withdraw my funds",
        "retirer mes fonds",
        "invest 250000 now",
        "send payout",
        "execute a distribution",
      ]) {
        const result = resolveClientNav(message);
        expect(result.kind).toBe("chat");
        expect(result.route).toBeUndefined();
      }
    });

    it("keeps ADMIN navigation on the server (client runs at LP scope)", () => {
      // 'créer un nouveau client' is an admin-customers intent. At LP scope it
      // resolves no destination AND is not a bare nav-verb gesture → server.
      const result = resolveClientNav("créer un nouveau client");
      expect(result.kind).toBe("chat");
      expect(result.route).toBeUndefined();
    });

    it("returns chat for empty input", () => {
      expect(resolveClientNav("").kind).toBe("chat");
      expect(resolveClientNav("   ").kind).toBe("chat");
    });
  });

  describe("kind: reject — a nav gesture with no LP destination", () => {
    it("rejects locally (zero network) when a nav verb matches no page", () => {
      // A clean nav-verb lead that resolves no whitelisted LP destination.
      const result = resolveClientNav("ouvre la lune");
      expect(result.kind).toBe("reject");
      expect(result.ack).toBe(NAV_REJECT_ACK);
      expect(result.route).toBeUndefined();
    });
  });
});
