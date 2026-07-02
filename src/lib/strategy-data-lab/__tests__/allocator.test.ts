import { describe, expect, it } from "vitest";

import {
  recommendAllocation,
  derivePricePoints,
  ALLOCATOR_MINING_FLOOR_BPS,
} from "../allocator";
import { LAB_BASE_COLLATERAL, LAB_BASE_RULES } from "../lab-defaults";
import type { ScenarioAssumptions } from "@/lib/product-strategies";

const BASE_ASSUMPTIONS: ScenarioAssumptions = {
  horizonMonths: 24,
  btcAnnualVol: 0.6,
  volatilityMultiplier: 1.0,
  distributionTargetLowBps: 700,
  distributionTargetHighBps: 1100,
  totalPerformanceLowBps: 900,
  totalPerformanceHighBps: 1400,
  floorBps: 600,
};

const INPUT = {
  btcPriceUsd: 60_169,
  collateral: LAB_BASE_COLLATERAL,
  rules: LAB_BASE_RULES,
  baseAssumptions: BASE_ASSUMPTIONS,
};

describe("recommendAllocation", () => {
  it("is deterministic, respects the mining floor, and sums to 100%", () => {
    const a = recommendAllocation(INPUT);
    const b = recommendAllocation(INPUT);
    expect(a).toEqual(b);

    expect(a.map((c) => c.key)).toEqual(["recommended", "defensive", "aggressive"]);
    for (const c of a) {
      expect(c.allocation.miningBps).toBeGreaterThanOrEqual(ALLOCATOR_MINING_FLOOR_BPS);
      const total =
        c.allocation.miningBps +
        c.allocation.btcBps +
        c.allocation.stableReserveBps +
        c.allocation.yieldOverlayBps;
      expect(total).toBe(10_000);
      // Percentile ordering is coherent.
      expect(c.p5RoiBps).toBeLessThanOrEqual(c.p50RoiBps);
      expect(c.p50RoiBps).toBeLessThanOrEqual(c.p95RoiBps);
    }

    // The defensive candidate never has a worse worst-case than the aggressive one.
    const defensive = a.find((c) => c.key === "defensive")!;
    const aggressive = a.find((c) => c.key === "aggressive")!;
    expect(defensive.p5RoiBps).toBeGreaterThanOrEqual(aggressive.p5RoiBps);
  });
});

describe("derivePricePoints", () => {
  it("derives delever / hard-liquidation / DCA levels in dollars, sorted", () => {
    const points = derivePricePoints(60_169, LAB_BASE_COLLATERAL, LAB_BASE_RULES);

    const delever = points.find((p) => p.id === "delever")!;
    const hard = points.find((p) => p.id === "hard-liquidation")!;
    // LTV = debt / (btc × price) ⇒ price at 45% LTV = 200k / (10 × 0.45)
    expect(Math.round(delever.priceUsd)).toBe(Math.round(200_000 / (10 * 0.45)));
    expect(Math.round(hard.priceUsd)).toBe(Math.round(200_000 / (10 * 0.8)));
    expect(hard.priceUsd).toBeLessThan(delever.priceUsd);
    expect(delever.tone).toBe("warning");
    expect(hard.tone).toBe("danger");

    // 4 reverse-DCA steps above today, ascending.
    const dca = points.filter((p) => p.id.startsWith("dca-"));
    expect(dca).toHaveLength(4);
    expect(dca[0]!.priceUsd).toBeGreaterThan(60_169);
    for (let i = 1; i < dca.length; i += 1) {
      expect(dca[i]!.priceUsd).toBeGreaterThan(dca[i - 1]!.priceUsd);
    }

    // Sorted ascending overall.
    const prices = points.map((p) => p.priceUsd);
    expect([...prices].sort((x, y) => x - y)).toEqual(prices);
  });
});
