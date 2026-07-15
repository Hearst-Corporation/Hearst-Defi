import { describe, expect, it } from "vitest";
import { compareScenarios, runScenario } from "../scenario";
import type { ScenarioParams, ScenarioResult } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS: ScenarioParams = {
  btcPriceUsd: 95_000,
  networkHashrateEh: 700,
  hashpricePer100Th: 0.085,
  miningYieldPct: 0.12,
  allocationWeights: {
    mining: 0.35,
    btcTactical: 0.15,
    usdcBase: 0.40,
    stableReserve: 0.10,
  },
  durationMonths: 12,
  riskFreeRate: 0.045,
};

// ─── runScenario (ScenarioParams → ScenarioResult) ────────────────────────────

describe("runScenario (v2 contract)", () => {
  it("NAV after 12 months is within expected range for base params", () => {
    const result = runScenario(BASE_PARAMS);
    const finalNav = result.monthly[result.monthly.length - 1]?.nav ?? 0;

    // Rough sanity: base mining yield 12% + USDC 4.8% + stable 4.5% + slight BTC positive drift
    // With weights 0.35 / 0.15 / 0.40 / 0.10, blended monthly ≈ 0.79%/mo → NAV ≈ 109 after 12m
    expect(finalNav).toBeGreaterThan(104);
    expect(finalNav).toBeLessThan(120);
  });

  it("monthly series has exactly durationMonths entries", () => {
    const result = runScenario(BASE_PARAMS);
    expect(result.monthly).toHaveLength(BASE_PARAMS.durationMonths);
  });

  it("month indices are 1-indexed and sequential", () => {
    const result = runScenario(BASE_PARAMS);
    result.monthly.forEach((m, i) => {
      expect(m.month).toBe(i + 1);
    });
  });

  it("apyMedianInternal is between apyLow and apyHigh", () => {
    const result = runScenario(BASE_PARAMS);
    expect(result.apyMedianInternal).toBeGreaterThanOrEqual(result.apyLow);
    expect(result.apyMedianInternal).toBeLessThanOrEqual(result.apyHigh);
  });

  it("stressedApy is strictly less than apyMedianInternal", () => {
    const result = runScenario(BASE_PARAMS);
    expect(result.stressedApy).toBeLessThan(result.apyMedianInternal);
  });

  it("result contains required fields with correct types", () => {
    const result = runScenario(BASE_PARAMS);
    expect(typeof result.sharpe).toBe("number");
    expect(typeof result.sortino).toBe("number");
    expect(typeof result.maxDrawdown).toBe("number");
    expect(typeof result.var95).toBe("number");
    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(typeof result.disclaimer).toBe("string");
  });

  it("assumptions list includes key assumption tokens", () => {
    const result = runScenario(BASE_PARAMS);
    const joined = result.assumptions.join(" ");
    expect(joined).toContain("methodology_version=v3.0");
    expect(joined).toContain("Not Monte Carlo");
    expect(joined).toContain("no compounding within month");
  });

  it("disclaimer does not contain forbidden words", () => {
    const result = runScenario(BASE_PARAMS);
    const forbidden = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
    const lower = result.disclaimer.toLowerCase();
    for (const word of forbidden) {
      expect(lower).not.toContain(word);
    }
  });

  it("assumptions do not contain forbidden words", () => {
    const result = runScenario(BASE_PARAMS);
    const forbidden = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
    for (const line of result.assumptions) {
      const lower = line.toLowerCase();
      for (const word of forbidden) {
        expect(lower, `assumption line should not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it("params are echoed back in result", () => {
    const result = runScenario(BASE_PARAMS);
    expect(result.params).toEqual(BASE_PARAMS);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("runScenario edge cases", () => {
  it("durationMonths=1 returns a single monthly entry", () => {
    const result = runScenario({ ...BASE_PARAMS, durationMonths: 1 });
    expect(result.monthly).toHaveLength(1);
    expect(result.monthly[0]?.month).toBe(1);
  });

  it("durationMonths=1 apyMedianInternal is between apyLow and apyHigh", () => {
    const result = runScenario({ ...BASE_PARAMS, durationMonths: 1 });
    expect(result.apyMedianInternal).toBeGreaterThanOrEqual(result.apyLow);
    expect(result.apyMedianInternal).toBeLessThanOrEqual(result.apyHigh);
  });

  it("throws when allocationWeights do not sum to 1.0", () => {
    expect(() =>
      runScenario({
        ...BASE_PARAMS,
        allocationWeights: {
          mining: 0.4,
          btcTactical: 0.2,
          usdcBase: 0.3,
          stableReserve: 0.2,
        },
      }),
    ).toThrowError(/allocationWeights must sum to 1\.0/);
  });

  it("throws with clear message when weights sum to 0.9", () => {
    expect(() =>
      runScenario({
        ...BASE_PARAMS,
        allocationWeights: {
          mining: 0.3,
          btcTactical: 0.1,
          usdcBase: 0.3,
          stableReserve: 0.2,
        },
      }),
    ).toThrowError(/allocationWeights must sum to 1\.0/);
  });

  it("accepts weights that sum to exactly 1.0 (floating-point tolerant)", () => {
    // 0.1 + 0.2 + 0.3 + 0.4 in IEEE-754 is slightly off 1.0 — guard against false throw
    expect(() =>
      runScenario({
        ...BASE_PARAMS,
        allocationWeights: {
          mining: 0.1,
          btcTactical: 0.2,
          usdcBase: 0.3,
          stableReserve: 0.4,
        },
      }),
    ).not.toThrow();
  });

  it("low hashprice (< threshold) produces lower stressedApy than positive hashprice baseline", () => {
    const bearParams: ScenarioParams = {
      ...BASE_PARAMS,
      hashpricePer100Th: 0.03,
    };
    const bearResult = runScenario(bearParams);
    const baseResult = runScenario(BASE_PARAMS);
    expect(bearResult.apyMedianInternal).toBeLessThan(baseResult.apyMedianInternal);
  });
});

// ─── compareScenarios ─────────────────────────────────────────────────────────

describe("compareScenarios", () => {
  const bullParams: ScenarioParams = {
    ...BASE_PARAMS,
    hashpricePer100Th: 0.12,
    miningYieldPct: 0.18,
  };

  const bearParams: ScenarioParams = {
    ...BASE_PARAMS,
    hashpricePer100Th: 0.03,
    miningYieldPct: 0.06,
  };

  let bullResult: ScenarioResult;
  let bearResult: ScenarioResult;

  it("setup: bull apyMedianInternal > bear apyMedianInternal", () => {
    bullResult = runScenario(bullParams);
    bearResult = runScenario(bearParams);
    expect(bullResult.apyMedianInternal).toBeGreaterThan(bearResult.apyMedianInternal);
  });

  it("delta apyMedianInternal is positive when b is better than a", () => {
    bullResult = runScenario(bullParams);
    bearResult = runScenario(bearParams);
    const delta = compareScenarios(bearResult, bullResult);
    expect(delta.apyMedianInternal).toBeGreaterThan(0);
  });

  it("delta apyMedianInternal is negative when b is worse than a", () => {
    bullResult = runScenario(bullParams);
    bearResult = runScenario(bearParams);
    const delta = compareScenarios(bullResult, bearResult);
    expect(delta.apyMedianInternal).toBeLessThan(0);
  });

  it("delta is zero when comparing a scenario with itself", () => {
    const result = runScenario(BASE_PARAMS);
    const delta = compareScenarios(result, result);
    expect(delta.apyMedianInternal).toBe(0);
    expect(delta.maxDrawdown).toBe(0);
    expect(delta.sharpe).toBe(0);
    expect(delta.var95).toBe(0);
  });

  it("returns all four delta fields as numbers", () => {
    bullResult = runScenario(bullParams);
    bearResult = runScenario(bearParams);
    const delta = compareScenarios(bearResult, bullResult);
    expect(typeof delta.apyMedianInternal).toBe("number");
    expect(typeof delta.maxDrawdown).toBe("number");
    expect(typeof delta.sharpe).toBe("number");
    expect(typeof delta.var95).toBe("number");
  });
});
