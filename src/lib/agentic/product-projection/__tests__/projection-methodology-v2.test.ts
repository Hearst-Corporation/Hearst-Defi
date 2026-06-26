/**
 * Projection Methodology v2 — seeded p5/p50/p95 distribution.
 *
 * Pure & deterministic: reuses the existing seeded PRNG. No Math.random, no
 * Date.now. Same (seed, iterations, inputs) → identical distribution.
 */

import { describe, it, expect } from "vitest";

import {
  buildProjectionDistribution,
  buildProjectionArtifact,
  assertProjectionArtifactSafe,
  type ProductProjectionInput,
} from "../index";

const BASE: ProductProjectionInput = {
  productName: "Hearst Yield Vault",
  productType: "vault",
  capitalBase: 1_000_000,
  currency: "USDC",
  apyRange: { min: 8, max: 15 },
  horizonMonths: 12,
  methodology: { version: "v2", seed: "demo-seed", iterations: 2000 },
};

describe("buildProjectionDistribution — seeded & deterministic", () => {
  it("same seed + inputs → identical distribution", () => {
    expect(buildProjectionDistribution(BASE)).toEqual(buildProjectionDistribution(BASE));
  });

  it("a different seed yields a different sample", () => {
    const a = buildProjectionDistribution(BASE)!;
    const b = buildProjectionDistribution({
      ...BASE,
      methodology: { ...BASE.methodology, seed: "other-seed" },
    })!;
    // Stochastic model → the percentile sample should differ for a different seed.
    const same =
      a.percentiles.p5.apyPct === b.percentiles.p5.apyPct &&
      a.percentiles.p95.apyPct === b.percentiles.p95.apyPct;
    expect(same).toBe(false);
  });

  it("respects p5 ≤ p50 ≤ p95 and stays inside the provided range", () => {
    const d = buildProjectionDistribution(BASE)!;
    const { p5, p50, p95 } = d.percentiles;
    expect(p5.apyPct).toBeLessThanOrEqual(p50.apyPct);
    expect(p50.apyPct).toBeLessThanOrEqual(p95.apyPct);
    expect(p5.apyPct).toBeGreaterThanOrEqual(8);
    expect(p95.apyPct).toBeLessThanOrEqual(15);
  });

  it("never invents numbers when apyRange is absent (returns null)", () => {
    const d = buildProjectionDistribution({
      productName: "Thin",
      productType: "fund",
      methodology: { version: "v2", seed: 7 },
    });
    expect(d).toBeNull();
  });

  it("clamps iterations into [100, 10000]", () => {
    const lo = buildProjectionDistribution({
      ...BASE,
      methodology: { version: "v2", seed: "s", iterations: 1 },
    })!;
    const hi = buildProjectionDistribution({
      ...BASE,
      methodology: { version: "v2", seed: "s", iterations: 99_999 },
    })!;
    expect(lo.methodology.iterations).toBe(100);
    expect(hi.methodology.iterations).toBe(10_000);
  });

  it("emits no NaN/Infinity and states limitations", () => {
    const d = buildProjectionDistribution(BASE)!;
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/NaN|Infinity/);
    expect(d.methodology.limitations.length).toBeGreaterThan(0);
    expect(d.bands.length).toBeGreaterThan(0);
    expect(d.bands.at(-1)!.horizonMonth).toBe(12);
  });

  it("derives a deterministic seed when none is provided (never random)", () => {
    const noSeed: ProductProjectionInput = {
      ...BASE,
      methodology: { version: "v2" },
    };
    const a = buildProjectionDistribution(noSeed)!;
    const b = buildProjectionDistribution(noSeed)!;
    expect(a.methodology.seed).toBe(b.methodology.seed);
    expect(a.methodology.seed.startsWith("derived:")).toBe(true);
  });
});

describe("artifact v2 integration", () => {
  it("v0 is unchanged when no methodology is requested", () => {
    const a = buildProjectionArtifact({
      productName: "P",
      productType: "vault",
      apyRange: { min: 8, max: 15 },
      capitalBase: 1000,
    });
    expect(a.version).toBe("v0");
    expect(a.methodology).toBeUndefined();
    expect(a.distribution).toBeUndefined();
    expect(a.charts.some((c) => c.type === "percentile_band")).toBe(false);
  });

  it("v2 adds methodology + distribution + percentile_band chart, passes guards", () => {
    const a = buildProjectionArtifact(BASE);
    expect(a.version).toBe("v2");
    expect(a.methodology?.model).toBe("seeded_scenario_distribution");
    expect(a.distribution).toBeDefined();
    expect(a.charts.some((c) => c.type === "percentile_band")).toBe(true);
    expect(assertProjectionArtifactSafe(a)).toEqual([]);
    // Determinism end to end.
    expect(buildProjectionArtifact(BASE)).toEqual(a);
  });

  it("v2 requested without apyRange → methodology unavailable (missingInputs), not fabricated", () => {
    const a = buildProjectionArtifact({
      productName: "Thin",
      productType: "strategy",
      methodology: { version: "v2", seed: 1 },
    });
    expect(a.version).toBe("v0");
    expect(a.distribution).toBeUndefined();
    expect(a.missingInputs).toContain("methodology_v2(needs apyRange)");
  });

  it("the guard flags a tampered percentile ordering", () => {
    const a = buildProjectionArtifact(BASE);
    const bad = {
      ...a,
      distribution: {
        ...a.distribution!,
        percentiles: {
          ...a.distribution!.percentiles,
          p5: { ...a.distribution!.percentiles.p5, apyPct: 99 },
        },
      },
    };
    const v = assertProjectionArtifactSafe(bad);
    expect(v.some((x) => x.kind === "v2_percentile_order")).toBe(true);
  });
});
