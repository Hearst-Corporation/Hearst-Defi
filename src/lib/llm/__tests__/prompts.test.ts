import { describe, expect, it } from "vitest";

import { VAULT_BTC_PLUS, VAULT_DEFENSIVE } from "@/lib/engine/vaults";
import {
  COCKPIT_ADMIN_SYSTEM_PROMPT,
  buildRoleDirective,
  COCKPIT_DEFAULT_SYSTEM_PROMPT,
} from "@/lib/llm/prompts";
import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
} from "@/lib/products/dynavault-factsheet";

describe("buildRoleDirective", () => {
  it("returns the strict LP directive for an investor", () => {
    const d = buildRoleDirective("investor");
    expect(d).toContain("external investor (LP)");
    expect(d).toContain("STRICTLY formal register");
  });

  it("defaults to the strict LP directive for null/unknown role (safe default)", () => {
    expect(buildRoleDirective(null)).toBe(buildRoleDirective("investor"));
    expect(buildRoleDirective(undefined)).toBe(buildRoleDirective("investor"));
    expect(buildRoleDirective("wat")).toBe(buildRoleDirective("investor"));
  });

  it("returns the internal directive for an admin (tutoiement, no secrets)", () => {
    const d = buildRoleDirective("admin");
    expect(d).toContain("internal");
    expect(d).toMatch(/Casual register/i);
    expect(d).toMatch(/NEVER disclose/i);
  });
});

describe("COCKPIT_DEFAULT_SYSTEM_PROMPT", () => {
  it("still carries the load-bearing guardrails", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("APY always as a range");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("GPT-4.1");
  });
});

describe("COCKPIT_DEFAULT_SYSTEM_PROMPT — product education compliance (every vault is a range)", () => {
  it("rule #1 extends the range rule to EVERY product/vault, not just HYV", () => {
    // Without this, the model gave a single-point target for the secondary vaults
    // (Defensive ~6 %, BTC Plus ~20 %) because the prompt only published HYV's
    // range → the output guard CORRECTLY flagged single_point_apy, blocking the
    // educational answer to "Explique-moi comment marchent les produits".
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("EVERY product/vault");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toMatch(/qualitative/i);
  });

  it("the multi-vault block tells the model NOT to cite a single figure for secondary vaults", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("Defensive");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("BTC Plus");
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toMatch(
      /without inventing or citing a single numeric yield/i,
    );
  });

  it("still pins HYV's published range (8 à 15 %) — the rule is range-only, not figure-free", () => {
    expect(COCKPIT_DEFAULT_SYSTEM_PROMPT).toContain("8 to 15 %");
  });
});

describe("COCKPIT_ADMIN_SYSTEM_PROMPT", () => {
  it("declares canonical allocations and admin limits", () => {
    // HYV = the three-pocket mining note (methodology v3.0 §2 table +
    // VAULT_SPEC_V2.1 §6), NOT the retired four-sleeve mix. The percentages are
    // literals ON PURPOSE — they are the human-reviewed canon, so moving an
    // allocation must break this test and force an explicit ack. The bps come
    // from the shipped constants, which cross-checks that the prompt renders the
    // SAME allocation the product reads (that agreement is what broke before).
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain(
      `B1 Mining Power 40 % (${B1_MINING_ALLOCATION_BPS} bps`,
    );
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain(
      `B2 BTC Pouch 27 % (${B2_BTC_ALLOCATION_BPS} bps`,
    );
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain(
      `B3 Reserve 33 % (${B3_USDC_ALLOCATION_BPS} bps`,
    );
    // Secondary vaults are NOT the note — they keep the legacy sleeve shape
    // (ADR-006), rendered from the engine presets.
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("HDV = mining 20 %");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("HBP = mining 40 %");
    expect(VAULT_DEFENSIVE.allocationTargets.mining).toBe(20);
    expect(VAULT_BTC_PLUS.allocationTargets.mining).toBe(40);
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("You have no free web browser");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("You cannot deploy");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("demo plan");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("chart spec");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("/admin/product-workspace");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toContain("CoinGecko");
  });

  it("does NOT feed the admin copilot the retired four-sleeve HYV model", () => {
    // The regression this pins: the prompt asserted "HYV = mining 60 %, tactical
    // BTC 25 %, USDC base 10 %, stable reserve 5 %" as a CANONICAL fact long
    // after the reframe (453dfcf0 / ADR-019) made HYV a 3-pocket mining note.
    // The old test asserted that same string, so it locked the lie in place.
    // v3.0 §2 is the source of truth: 40 / 27 / 33, B1 / B2 / B3.
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).not.toContain("HYV = mining 60 %");
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).not.toMatch(/HYV[^.]*stable reserve/i);
    // The note is not an ERC-4626 and pays no periodic distribution.
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toMatch(/PermissionedDynaVault v2\.1/);
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toMatch(/not an ERC-4626/i);
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toMatch(/no periodic cash distribution/i);
  });

  it("keeps the range rule intact — no single-point return for the note", () => {
    // v3.0 §3: headline is always a range in accumulated BTC, and v3.0 publishes
    // NO per-pocket rate. The pocket figures above are ALLOCATIONS, not yields.
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toMatch(/range in accumulated BTC/i);
    expect(COCKPIT_ADMIN_SYSTEM_PROMPT).toMatch(/never a single-point figure/i);
    for (const forbidden of [
      "guarantee",
      "promise",
      "certain",
      "will deliver",
      "risk-free",
    ]) {
      expect(COCKPIT_ADMIN_SYSTEM_PROMPT.toLowerCase()).not.toContain(forbidden);
    }
  });
});
