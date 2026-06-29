import { describe, expect, it } from "vitest";

import { buildProjectionInputPreset } from "../projection-input-preset";

// Every numeric/business field that must NEVER appear as a prepared value.
const NUMERIC_FORBIDDEN = /\b(\d+(\.\d+)?\s?%|apy|ltv|hashprice|markup|revenue.?share|borrow|risk.?score|p5|p50|p95)\s*[:=]/i;

describe("buildProjectionInputPreset — safe, non-numeric preset", () => {
  it("mining + stable → safe product type + buckets, source product-workspace", () => {
    const p = buildProjectionInputPreset("Crée un produit mining + stable yield USDC");
    expect(p.source).toBe("product-workspace");
    expect(p.safeFields.productType).toBe("mining_stable_yield");
    expect(p.safeFields.bucketLabels).toContain("Mining");
    expect(p.safeFields.bucketLabels).toContain("USDC");
    expect(p.hasSafeFields).toBe(true);
    expect(p.methodologyVersion).toBe("v1.0");
  });

  it("BTC collateral → BTC bucket", () => {
    const p = buildProjectionInputPreset("Vault BTC collateral avec LTV maîtrisé");
    expect(p.safeFields.productType).toBe("btc_collateral");
    expect(p.safeFields.bucketLabels).toContain("BTC");
  });

  it("unknown objective → no safe product type, review still required, warned", () => {
    const p = buildProjectionInputPreset("un truc sympa pour les gens");
    expect(p.safeFields.productType).toBeUndefined();
    expect(p.hasSafeFields).toBe(false);
    expect(p.reviewRequired.length).toBeGreaterThan(0);
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it("an APY number in the objective is NEVER prefilled as a value", () => {
    const p = buildProjectionInputPreset("Produit mining + stable yield ciblant 20% APY");
    // No safe field carries a numeric APY/business value.
    const blob = JSON.stringify(p.safeFields);
    expect(blob).not.toMatch(NUMERIC_FORBIDDEN);
    // The objective string is carried verbatim (may contain "20%"), but APY/LTV/etc.
    // appear in forbiddenPrefill, never in safeFields as a prepared number.
    expect(p.forbiddenPrefill).toContain("APY target");
    expect(p.safeFields).not.toHaveProperty("apy");
    expect(p.safeFields).not.toHaveProperty("apyTarget");
  });

  it("an LTV number in the objective is NEVER prefilled as a value", () => {
    const p = buildProjectionInputPreset("BTC collateral LTV 65% sur mining");
    expect(JSON.stringify(p.safeFields)).not.toMatch(NUMERIC_FORBIDDEN);
    expect(p.forbiddenPrefill).toContain("Exact LTV");
  });

  it("'20% guaranteed APY' yields warnings + forbidden boundary, not a number", () => {
    const p = buildProjectionInputPreset("20% guaranteed APY mining");
    expect(JSON.stringify(p.safeFields)).not.toMatch(NUMERIC_FORBIDDEN);
    expect(p.forbiddenPrefill).toContain("APY target");
  });

  it("review-required lists the financial inputs the preset never touches", () => {
    const p = buildProjectionInputPreset("mining stable");
    expect(p.reviewRequired).toContain("Revenue share (CONFIGURED)");
    expect(p.reviewRequired).toContain("Hashprice (USD/TH/day)");
    expect(p.reviewRequired.some((r) => r.includes("Risk references"))).toBe(true);
  });

  it("forbidden-prefill enumerates every business number", () => {
    const p = buildProjectionInputPreset("mining stable");
    for (const f of ["APY target", "Markup", "Borrow APR", "Allocation percentages", "p5 / p50 / p95", "Hashprice"]) {
      expect(p.forbiddenPrefill).toContain(f);
    }
  });

  it("is pure/deterministic", () => {
    expect(buildProjectionInputPreset("mining stable USDC")).toEqual(
      buildProjectionInputPreset("mining stable USDC"),
    );
  });

  it("label is bounded and never a number", () => {
    const long = "mining stable " + "x".repeat(500);
    const p = buildProjectionInputPreset(long);
    expect((p.safeFields.label ?? "").length).toBeLessThanOrEqual(81);
  });
});
