import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/llm/navigate-tool";
import {
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

  it("opens new LP sub-pages without touching the LLM", () => {
    expect(resolveLpNavDestinationKey("ouvre mes distributions")).toBe(
      "portfolio-distributions",
    );
    expect(resolveLpNavDestinationKey("va sur ma fiscalité")).toBe(
      "portfolio-tax",
    );
    expect(resolveLpNavDestinationKey("montre-moi mon rendement")).toBe(
      "portfolio-yield",
    );
    expect(resolveLpNavDestinationKey("ouvre mes positions")).toBe(
      "portfolio-positions",
    );
    expect(resolveLpNavDestinationKey("consulte mon activité")).toBe(
      "portfolio-activity",
    );
    expect(resolveLpNavDestinationKey("ouvre les mentions légales")).toBe(
      "legal",
    );
  });

  it("opens new admin pages without touching the LLM", () => {
    expect(resolveAdminNavFallbackKey("ouvre la page sécurité")).toBe(
      "admin-security",
    );
    expect(resolveAdminNavFallbackKey("va sur les signals")).toBe(
      "admin-signals",
    );
    expect(resolveAdminNavFallbackKey("montre-moi l'audit")).toBe("admin-audit");
    expect(resolveAdminNavFallbackKey("ouvre le monitoring")).toBe(
      "admin-monitoring",
    );
    expect(resolveAdminNavFallbackKey("ouvre les agents")).toBe("admin-agents");
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
