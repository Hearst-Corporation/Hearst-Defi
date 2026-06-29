import { describe, expect, it } from "vitest";

import {
  BTC_MINING_PERFORMANCE_VAULT,
  type ProductValueStatus,
} from "@/lib/products/btc-mining-performance-vault";
import { getCoverageState } from "@/lib/engine/coverage";
import { containsForbidden } from "@/lib/agents/forbidden-words";

const P = BTC_MINING_PERFORMANCE_VAULT;

describe("BTC_MINING_PERFORMANCE_VAULT — product constant", () => {
  it("has the canonical id, thesis, status and target duration", () => {
    expect(P.id).toBe("btc-mining-performance-vault");
    expect(P.name).toBe("BTC Mining Performance Vault");
    expect(P.thesis).toBe("Mining-first commercially, BTC-cycle-aware financially");
    expect(P.status).toBe<ProductValueStatus>("CONFIGURED");
    expect(P.targetDurationMonths).toBe(24);
  });

  it("every guarantee is false (no guaranteed yield/principal/auto-execution)", () => {
    expect(P.guarantees.guaranteedYield).toBe(false);
    expect(P.guarantees.guaranteedPrincipal).toBe(false);
    expect(P.guarantees.automaticExecution).toBe(false);
  });

  it("targets are ranges and the total is inclusive of distributions (never additive)", () => {
    expect(P.monthlyDistributionTargetAnnualized.min).toBe(0.08);
    expect(P.monthlyDistributionTargetAnnualized.max).toBe(0.12);
    expect(P.totalPerformanceTarget.min).toBe(0.2);
    expect(P.totalPerformanceTarget.max).toBe(0.24);
    expect(P.totalPerformanceTarget.inclusiveOfDistributions).toBe(true);
    // both are real ranges, never a single point
    expect(P.monthlyDistributionTargetAnnualized.max).toBeGreaterThan(
      P.monthlyDistributionTargetAnnualized.min,
    );
    expect(P.totalPerformanceTarget.max).toBeGreaterThan(
      P.totalPerformanceTarget.min,
    );
  });

  it("mining floor is 0.30 and the band is 30–40%", () => {
    expect(P.allocation.mining.floor).toBe(0.3);
    expect(P.allocation.mining.min).toBe(0.3);
    expect(P.allocation.mining.max).toBe(0.4);
  });

  it("sleeves match the doc: BTC 40–55%, stable 10–15%, overlay 0–10% excess-only", () => {
    expect(P.allocation.btcHoldingCollateral.min).toBe(0.4);
    expect(P.allocation.btcHoldingCollateral.max).toBe(0.55);
    expect(P.allocation.stableFundingReserve.min).toBe(0.1);
    expect(P.allocation.stableFundingReserve.max).toBe(0.15);
    expect(P.allocation.yieldOverlay.min).toBe(0.0);
    expect(P.allocation.yieldOverlay.max).toBe(0.1);
    expect(P.allocation.yieldOverlay.excessOnly).toBe(true);
  });

  it("carries the 3 regime bands (balanced / accumulation / harvest)", () => {
    const regimes = P.regimeBands.map((b) => b.regime);
    expect(regimes).toEqual(["balanced", "accumulation", "harvest"]);
    for (const band of P.regimeBands) {
      expect(band.status).toBe("CONFIGURED");
      // mining never below the floor in any regime band
      expect(band.mining[0]).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("recovery is 6–12 months, default Mode A capital_only", () => {
    expect(P.recovery.extensionMonths.min).toBe(6);
    expect(P.recovery.extensionMonths.max).toBe(12);
    expect(P.recovery.defaultMode).toBe("capital_only");
  });

  it("every lever carries status CONFIGURED with the doc's values", () => {
    expect(P.levers.markupPct).toEqual({ value: 0.15, status: "CONFIGURED" });
    expect(P.levers.revenueSharePct).toEqual({ value: 0.2, status: "CONFIGURED" });
    expect(P.levers.energyCostUsdPerKwh).toEqual({
      value: 0.06,
      status: "CONFIGURED",
    });
    expect(P.levers.borrowAprPct).toEqual({ value: 0.06, status: "CONFIGURED" });
    expect(P.levers.machineLifeYears).toEqual({ value: 5, status: "CONFIGURED" });
    expect(P.levers.btcScenarios.value).toEqual({
      bear: -0.2,
      base: 0.4,
      bull: 1.2,
    });
    expect(P.levers.btcScenarios.status).toBe("CONFIGURED");
    expect(P.levers.ltv.value).toEqual({
      avg: 0.5,
      trim: 0.55,
      buffer: 0.58,
      cap: 0.6,
      liquidation: 0.825,
    });
    expect(P.levers.ltv.status).toBe("CONFIGURED");
  });

  it("coverage bands agree with the engine's canonical classifier (no silent drift)", () => {
    const b = P.levers.coverageBands.value;
    expect(P.levers.coverageBands.status).toBe("CONFIGURED");
    // The product bands must classify exactly as the engine does.
    expect(getCoverageState(b.healthy)).toBe("healthy");
    expect(getCoverageState(b.adequate)).toBe("adequate");
    expect(getCoverageState(b.stressed)).toBe("stressed");
    // just below adequate is stressed; just below stressed is suspended
    expect(getCoverageState(b.adequate - 0.0001)).toBe("stressed");
    expect(getCoverageState(b.stressed - 0.0001)).toBe("suspended");
  });

  it("no guarantee language anywhere in the product's text fields", () => {
    const text = [P.name, P.thesis, ...P.regimeBands.map((r) => r.label)].join(
      " ",
    );
    expect(containsForbidden(text)).toBeNull();
  });
});
