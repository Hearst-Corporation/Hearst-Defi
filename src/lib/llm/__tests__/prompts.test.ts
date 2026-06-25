import { describe, expect, it } from "vitest";

import {
  COCKPIT_ADMIN_SYSTEM_PROMPT,
  buildRoleDirective,
  COCKPIT_DEFAULT_SYSTEM_PROMPT,
} from "@/lib/llm/prompts";

describe("buildRoleDirective", () => {
  it("returns the strict LP directive for an investor", () => {
    const d = buildRoleDirective("investor");
    expect(d).toContain("investisseur (LP)");
    expect(d).toContain("Vouvoiement STRICT");
  });

  it("defaults to the strict LP directive for null/unknown role (safe default)", () => {
    expect(buildRoleDirective(null)).toBe(buildRoleDirective("investor"));
    expect(buildRoleDirective(undefined)).toBe(buildRoleDirective("investor"));
    expect(buildRoleDirective("wat")).toBe(buildRoleDirective("investor"));
  });

  it("returns the internal directive for an admin (tutoiement, no secrets)", () => {
    const d = buildRoleDirective("admin");
    expect(d).toContain("interne");
    expect(d).toMatch(/Tutoiement/i);
    expect(d).toMatch(/ne divulgue/i);
  });
});

describe("COCKPIT_DEFAULT_SYSTEM_PROMPT", () => {
  it("still carries the load-bearing guardrails", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("APY toujours en fourchette");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("GPT-4.1");
  });
});

describe("COCKPIT_DEFAULT_SYSTEM_PROMPT — product education compliance (every vault is a range)", () => {
  it("rule #1 extends the range rule to EVERY product/vault, not just HYV", () => {
    // Without this, the model gave a single-point target for the secondary vaults
    // (Defensive ~6 %, BTC Plus ~20 %) because the prompt only published HYV's
    // range → the output guard CORRECTLY flagged single_point_apy, blocking the
    // educational answer to "Explique-moi comment marchent les produits".
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("CHAQUE produit/vault");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toMatch(/qualitatif/i);
  });

  it("the multi-vault block tells the model NOT to cite a single figure for secondary vaults", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("Defensive");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("BTC Plus");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toMatch(
      /sans inventer ni citer de rendement chiffré unique/i,
    );
  });

  it("still pins HYV's published range (8 à 15 %) — the rule is range-only, not figure-free", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("8 à 15 %");
  });
});

describe("COCKPIT_ADMIN_SYSTEM_PROMPT", () => {
  it("declares canonical allocations and admin limits", () => {
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("HYV = mining 60 %");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("HDV = mining 20 %");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("HBP = mining 40 %");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("Tu n'as pas de navigateur web");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("Tu ne peux pas déployer");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("plan démo");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("spec graphique");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("/admin/product-workspace");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("/admin/scenario-lab");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("CoinGecko");
  });
});
