import { describe, expect, it } from "vitest";

import {
  COCKPIT_ADMIN_SYSTEM_PROMPT,
  COCKPIT_DEFAULT_SYSTEM_PROMPT,
} from "@/lib/llm/prompts";
import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";

/**
 * Chat P2 Coherence Cleanup.
 *
 * Pins the prompt↔runtime coherence fixes (no behaviour change to any runtime
 * guard or the nav router):
 *  - the system prompts no longer claim the model has a "navigate" TOOL (nav is
 *    100% deterministic, resolved before the model — the model exposes no such
 *    tool);
 *  - the prompt forbidden-words list stays aligned with the guard's authority
 *    (the guard is the source of truth; the prompt just steers the model);
 *  - PRODUCT_CREATION_VERB_RE gained the accented "crée" inflection without
 *    widening into projection/campaign territory.
 */

// ---------------------------------------------------------------------------
// 1. No prompt claims a navigate TOOL exposed to the model
// ---------------------------------------------------------------------------

describe("prompts — deterministic navigation, no navigate tool", () => {
  const prompts = [
    ["admin", COCKPIT_ADMIN_SYSTEM_PROMPT],
    ["default", COCKPIT_DEFAULT_SYSTEM_PROMPT],
  ] as const;

  for (const [name, prompt] of prompts) {
    it(`${name} prompt does NOT describe a navigate tool the model calls`, () => {
      // No phrasing that tells the model to CALL a navigate tool.
      expect(prompt).not.toMatch(/l'outil navigate/i);
      expect(prompt).not.toMatch(/appelle navigate/i);
      expect(prompt).not.toMatch(/via l'outil navigate/i);
      expect(prompt).not.toMatch(/navigate avec/i);
    });

    it(`${name} prompt states navigation is system-resolved / deterministic`, () => {
      expect(prompt).toMatch(/deterministic|resolved by the system|handled by the system/i);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Prompt forbidden-words wording stays aligned with the guard authority
// ---------------------------------------------------------------------------

describe("prompts — forbidden-words wording aligned with the guard", () => {
  it("names the runtime guard as the final authority", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toMatch(/output guard|garde-fou serveur/i);
  });

  it("lists the canonical forbidden claims the guard enforces", () => {
    const p = COCKPIT_DEFAULT_SYSTEM_PROMPT;
    for (const needle of [
      "promise",
      "certain",
      "will deliver",
      "capital protected",
      "guarantee",
      "risk-free",
      "no risk",
      "assured",
      "protected against downside",
    ]) {
      expect(p.toLowerCase()).toContain(needle.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// 3. "crée" (accented) creation alias — product creation, not projection/campaign
// ---------------------------------------------------------------------------

describe("product creation — accented 'crée' alias", () => {
  it("'crée un produit' opens the Product Workspace (parity with 'créer'/'cree')", () => {
    expect(
      classifyProductWorkspaceIntent("crée un produit").shouldOpenProductWorkspace,
    ).toBe(true);
    expect(
      classifyProductWorkspaceIntent("crée un nouveau produit").shouldOpenProductWorkspace,
    ).toBe(true);
  });

  it("the existing inflections still work (no regression)", () => {
    for (const m of ["créer un produit", "cree un produit", "création d'un produit"]) {
      expect(classifyProductWorkspaceIntent(m).shouldOpenProductWorkspace).toBe(true);
    }
  });

  it("'crée une projection' does NOT open the Product Workspace", () => {
    expect(
      classifyProductWorkspaceIntent("crée une projection").shouldOpenProductWorkspace,
    ).toBe(false);
  });

  it("'crée une campagne' does NOT become a product intent", () => {
    expect(
      classifyProductWorkspaceIntent("crée une campagne").shouldOpenProductWorkspace,
    ).toBe(false);
  });
});
