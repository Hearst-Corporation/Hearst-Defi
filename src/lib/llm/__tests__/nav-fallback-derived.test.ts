import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/llm/navigate-tool";
import {
  NAV_CANONICAL_MATRIX,
  NAV_KEYWORDS,
  resolveLpNavDestinationKey,
  resolveAdminNavFallbackKey,
} from "@/lib/llm/nav-fallback-intent";

describe("nav-fallback derived rules (regex covers the whole site)", () => {
  // Sync guard: every whitelist destination must have keywords so it is reachable
  // by the LLM-free regex fast-path. If this fails, a new page was added to the
  // whitelist without nav keywords.
  it("every whitelist destination has at least one keyword", () => {
    const missing = NAV_DESTINATIONS.filter(
      (d) => (NAV_KEYWORDS[d.key]?.length ?? 0) === 0,
    ).map((d) => d.key);
    expect(missing).toEqual([]);
  });

  it("canonical matrix keys stay mapped to real keywords", () => {
    const missingKeywords = NAV_CANONICAL_MATRIX.filter(
      (row) => (NAV_KEYWORDS[row.destinationKey]?.length ?? 0) === 0,
    ).map((row) => row.destinationKey);
    expect(missingKeywords).toEqual([]);
  });

  it("opens wired LP sub-pages, never the blank portfolio leaves", () => {
    // A wired LP destination still resolves LLM-free.
    expect(resolveLpNavDestinationKey("ouvre les mentions légales")).toBe(
      "legal",
    );
    // The portfolio sub-leaves were removed from the whitelist (unwired stubs), so
    // the regex no longer resolves them — even behind an explicit nav verb. The
    // chat can never route an investor to a blank surface.
    for (const phrase of [
      "ouvre mes distributions",
      "va sur ma fiscalité",
      "montre-moi mon rendement",
      "ouvre mes positions",
      "consulte mon activité",
    ]) {
      expect(resolveLpNavDestinationKey(phrase)).toBeNull();
    }
  });

  it("opens new admin pages without touching the LLM", () => {
    expect(resolveAdminNavFallbackKey("ouvre la page sécurité")).toBe(
      "admin-security",
    );
    expect(resolveAdminNavFallbackKey("va sur les signals")).toBe(
      "admin-signals",
    );
    expect(resolveAdminNavFallbackKey("montre-moi le monitoring")).toBe(
      "admin-monitoring",
    );
    // The Agent Library route (/admin/agents) was deleted, so its destination is
    // gone from the whitelist — "ouvre les agents" no longer resolves anywhere.
    expect(resolveAdminNavFallbackKey("ouvre les agents")).toBeNull();
    expect(resolveAdminNavFallbackKey("va sur agentic")).toBeNull();
  });

  it("does NOT hijack a conversational message (no nav verb)", () => {
    expect(
      resolveLpNavDestinationKey("je ne comprends pas mes distributions"),
    ).toBeNull();
    expect(
      resolveAdminNavFallbackKey("explique la sécurité de mes fonds"),
    ).toBeNull();
  });

  it("keeps hand-tuned rules as the priority", () => {
    // Generic portfolio still resolves to the parent.
    expect(resolveLpNavDestinationKey("ouvre mon portefeuille")).toBe(
      "portfolio",
    );
    // Hand-tuned admin-customers nuance survives.
    expect(
      resolveAdminNavFallbackKey("ouvre le portefeuille utilisateur"),
    ).toBe("admin-customers");
  });
});
