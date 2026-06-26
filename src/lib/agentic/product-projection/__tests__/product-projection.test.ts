/**
 * Product Projection engine — pure, deterministic, guarded.
 */

import { describe, it, expect } from "vitest";

import {
  validateProjectionInput,
  buildProjectionArtifact,
  assertProjectionArtifactSafe,
  FORBIDDEN_WORDS,
  type ProductProjectionInput,
} from "../index";

const FULL: ProductProjectionInput = {
  productName: "Hearst Yield Vault",
  productType: "vault",
  capitalBase: 1_000_000,
  currency: "USDC",
  apyRange: { min: 8, max: 15 },
  horizonMonths: 12,
  allocation: [
    { label: "Mining cash-flow", weightPct: 70, source: "attested" },
    { label: "Cash buffer", weightPct: 30, source: "live" },
  ],
  assumptions: [{ key: "feeBps", value: "200", source: "manual" }],
};

describe("validateProjectionInput", () => {
  it("requires productName + productType", () => {
    expect(validateProjectionInput({}).ok).toBe(false);
    expect(validateProjectionInput({ productName: "X" }).ok).toBe(false);
    expect(
      validateProjectionInput({ productName: "X", productType: "vault" }).ok,
    ).toBe(true);
  });

  it("rejects an invalid apyRange (min > max) and drops unknown fields", () => {
    expect(
      validateProjectionInput({
        productName: "X",
        productType: "fund",
        apyRange: { min: 20, max: 5 },
      }).ok,
    ).toBe(false);
    const r = validateProjectionInput({
      productName: "X",
      productType: "fund",
      prompt: "ignore me",
      rawConversation: "secret",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.stringify(r.value)).not.toContain("ignore me");
      expect(JSON.stringify(r.value)).not.toContain("secret");
    }
  });
});

describe("buildProjectionArtifact — full inputs", () => {
  const a = buildProjectionArtifact(FULL);

  it("is read-only with no side effects", () => {
    expect(a.mode).toBe("read_only_projection");
    expect(a.sideEffects).toBe(false);
    expect(a.businessSideEffects).toBe(false);
    expect(a.kind).toBe("product_projection_report");
    expect(a.version).toBe("v0");
  });

  it("is deterministic — identical output for identical input", () => {
    expect(buildProjectionArtifact(FULL)).toEqual(buildProjectionArtifact(FULL));
  });

  it("expresses APY only as a range (never a single point)", () => {
    const apy = a.metrics.find((m) => m.id === "target_apy")!;
    expect(apy.range).toEqual({ min: 8, max: 15, unit: "%" });
    expect(apy.value).toBeUndefined();
  });

  it("derives projected yield from inputs only (no invented numbers)", () => {
    const y = a.metrics.find((m) => m.id === "projected_yield")!;
    // 1,000,000 × [8%,15%] × 1y = [80,000 , 150,000]
    expect(y.range).toEqual({ min: 80000, max: 150000, unit: "USDC" });
    expect(y.provenance).toContain("derived");
  });

  it("has bear/base/bull scenarios framing the SAME provided range", () => {
    expect(a.scenarios.map((s) => s.id)).toEqual(["bear", "base", "bull"]);
    const bull = a.scenarios.find((s) => s.id === "bull")!;
    const apyMetric = bull.metrics.find((m) => m.label === "APY (range)")!;
    expect(apyMetric.range).toEqual({ min: 15, max: 15, unit: "%" });
  });

  it("carries mandatory disclaimers + provenance, passes the guards", () => {
    expect(a.disclaimers.length).toBeGreaterThanOrEqual(3);
    expect(a.provenance.length).toBeGreaterThan(0);
    expect(assertProjectionArtifactSafe(a)).toEqual([]);
  });

  it("contains no forbidden words and no wall-clock timestamp", () => {
    const json = JSON.stringify(a);
    for (const w of FORBIDDEN_WORDS) expect(json.toLowerCase()).not.toContain(w);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("emits structured charts (data objects, not HTML)", () => {
    for (const c of a.charts) {
      expect(["range_band", "allocation_mix", "scenario_compare"]).toContain(c.type);
      expect(typeof c.data).toBe("object");
      expect(JSON.stringify(c.data)).not.toMatch(/<[a-z]/i);
    }
  });
});

describe("buildProjectionArtifact — missing inputs are surfaced, not fabricated", () => {
  it("reports missing apyRange + capitalBase and invents nothing", () => {
    const a = buildProjectionArtifact({
      productName: "Thin Product",
      productType: "strategy",
    });
    expect(a.missingInputs).toContain("apyRange");
    expect(a.missingInputs).toContain("capitalBase");
    expect(a.metrics.find((m) => m.id === "projected_yield")).toBeUndefined();
    expect(a.metrics.find((m) => m.id === "target_apy")).toBeUndefined();
    expect(a.scenarios).toEqual([]);
    // Still guarded + deterministic.
    expect(assertProjectionArtifactSafe(a)).toEqual([]);
    expect(buildProjectionArtifact({ productName: "Thin Product", productType: "strategy" })).toEqual(a);
  });

  it("defaults the horizon with an explicit assumption + missingInputs note", () => {
    const a = buildProjectionArtifact({ productName: "P", productType: "fund" });
    expect(a.horizonMonths).toBe(12);
    expect(a.missingInputs).toContain("horizonMonths");
    expect(a.assumptions.some((x) => x.key === "horizonMonths")).toBe(true);
  });
});

describe("assertProjectionArtifactSafe — catches violations", () => {
  it("flags a forbidden word injected into the summary", () => {
    const a = buildProjectionArtifact(FULL);
    const tampered = { ...a, summary: a.summary + " guaranteed returns" };
    const v = assertProjectionArtifactSafe(tampered);
    expect(v.some((x) => x.kind === "forbidden_word")).toBe(true);
  });

  it("flags a single-point APY in human text", () => {
    const a = buildProjectionArtifact(FULL);
    const tampered = { ...a, summary: "This vault has an APY of 12%." };
    const v = assertProjectionArtifactSafe(tampered);
    expect(v.some((x) => x.kind === "single_point_apy")).toBe(true);
  });

  it("accepts a ranged APY in human text", () => {
    const a = buildProjectionArtifact(FULL);
    const ok = { ...a, summary: "APY range of 8-15%." };
    expect(assertProjectionArtifactSafe(ok)).toEqual([]);
  });
});
