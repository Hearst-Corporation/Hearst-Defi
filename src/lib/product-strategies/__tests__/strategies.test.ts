import { describe, it, expect } from "vitest";

import { PRODUCT_STRATEGIES, getFallbackStrategy } from "../strategies.config";
import { validateStrategy, validateStrategySet } from "../validate";
import { selectProductStrategy } from "../select";
import type { ProductStrategy } from "../types";

describe("strategy config — validation", () => {
  it("the seeded set passes every business rule", () => {
    expect(validateStrategySet(PRODUCT_STRATEGIES)).toEqual([]);
  });

  it("every scenario allocation sums to exactly 100% (10_000 bps)", () => {
    for (const s of PRODUCT_STRATEGIES) {
      for (const key of ["safe", "balanced", "opportunistic"] as const) {
        const a = s.scenarios[key].allocation;
        expect(a.miningBps + a.btcBps + a.stableReserveBps + a.yieldOverlayBps).toBe(10_000);
      }
    }
  });

  it("no allocation sleeve is negative", () => {
    for (const s of PRODUCT_STRATEGIES) {
      for (const key of ["safe", "balanced", "opportunistic"] as const) {
        for (const v of Object.values(s.scenarios[key].allocation)) {
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("Safe stable reserve ≥ Balanced; Opportunistic BTC ≥ Balanced", () => {
    for (const s of PRODUCT_STRATEGIES) {
      expect(s.scenarios.safe.allocation.stableReserveBps).toBeGreaterThanOrEqual(
        s.scenarios.balanced.allocation.stableReserveBps,
      );
      expect(s.scenarios.opportunistic.allocation.btcBps).toBeGreaterThanOrEqual(
        s.scenarios.balanced.allocation.btcBps,
      );
    }
  });

  it("effective volatility is non-decreasing Safe→Balanced→Opportunistic", () => {
    for (const s of PRODUCT_STRATEGIES) {
      const v = (k: "safe" | "balanced" | "opportunistic") =>
        s.scenarios[k].assumptions.btcAnnualVol * s.scenarios[k].assumptions.volatilityMultiplier;
      expect(v("safe")).toBeLessThanOrEqual(v("balanced") + 1e-9);
      expect(v("balanced")).toBeLessThanOrEqual(v("opportunistic") + 1e-9);
    }
  });

  it("exactly one active fallback strategy exists", () => {
    const fbs = PRODUCT_STRATEGIES.filter((s) => s.isFallback && s.status === "active");
    expect(fbs).toHaveLength(1);
    expect(getFallbackStrategy(PRODUCT_STRATEGIES).id).toBe(fbs[0]!.id);
  });

  it("no guaranteed wording anywhere in the config", () => {
    for (const s of PRODUCT_STRATEGIES) {
      expect(validateStrategy(s).filter((v) => v.code === "forbidden_wording")).toEqual([]);
    }
  });

  it("validation catches a broken allocation sum", () => {
    const broken: ProductStrategy = structuredCloneStrategy(PRODUCT_STRATEGIES[0]!);
    broken.scenarios.balanced.allocation.miningBps += 500;
    expect(validateStrategy(broken).some((v) => v.code === "allocation_sum")).toBe(true);
  });

  it("validation catches guaranteed wording", () => {
    const broken = structuredCloneStrategy(PRODUCT_STRATEGIES[0]!);
    broken.disclaimers = ["This product guarantees a 12% return."];
    expect(validateStrategy(broken).some((v) => v.code === "forbidden_wording")).toBe(true);
  });
});

describe("selectProductStrategy — deterministic matching", () => {
  it("mining family request → BTC Mining Performance", () => {
    const r = selectProductStrategy({ productFamily: "btc_mining" }, PRODUCT_STRATEGIES);
    expect(r.strategy.slug).toBe("btc-mining-performance");
    expect(r.fallbackUsed).toBe(false);
    expect(r.matchedRules).toContain("family:btc_mining");
  });

  it("stable income family + monthly income priority → Stable USDC Income", () => {
    const r = selectProductStrategy(
      { productFamily: "stable_income", priority: "monthly_income" },
      PRODUCT_STRATEGIES,
    );
    expect(r.strategy.slug).toBe("stable-income");
    expect(r.score).toBeGreaterThan(0);
  });

  it("structured selection outweighs a conflicting note", () => {
    // Family says stable, note says mining → structured family wins.
    const r = selectProductStrategy(
      { productFamily: "stable_income", note: "mining hashrate asic" },
      PRODUCT_STRATEGIES,
    );
    expect(r.strategy.slug).toBe("stable-income");
  });

  it("note-only mining keywords still select the mining strategy", () => {
    const r = selectProductStrategy({ note: "a mining asic hashrate product" }, PRODUCT_STRATEGIES);
    expect(r.strategy.slug).toBe("btc-mining-performance");
    expect(r.fallbackUsed).toBe(false);
  });

  it("no signal → active fallback (generic balanced)", () => {
    const r = selectProductStrategy({}, PRODUCT_STRATEGIES);
    expect(r.strategy.isFallback).toBe(true);
    expect(r.fallbackUsed).toBe(true);
  });

  it("is deterministic: same request → same result", () => {
    const req = { productFamily: "btc_mining", riskProfile: "safe" as const };
    expect(selectProductStrategy(req, PRODUCT_STRATEGIES)).toEqual(
      selectProductStrategy(req, PRODUCT_STRATEGIES),
    );
  });

  it("only active strategies are selectable (archived ignored)", () => {
    const archived = PRODUCT_STRATEGIES.map((s) =>
      s.slug === "btc-mining-performance" ? { ...s, status: "archived" as const } : s,
    );
    const r = selectProductStrategy({ productFamily: "btc_mining" }, archived);
    expect(r.strategy.slug).not.toBe("btc-mining-performance");
  });
});

/** Deep clone without Date/random (structuredClone is fine here). */
function structuredCloneStrategy(s: ProductStrategy): ProductStrategy {
  return JSON.parse(JSON.stringify(s)) as ProductStrategy;
}
