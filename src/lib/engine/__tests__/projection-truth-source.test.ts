import { describe, it, expect } from "vitest";

import {
  runScenario,
  DEFAULT_USDC_ANNUAL_YIELD,
  DEFAULT_STABLE_ANNUAL_YIELD,
} from "../scenario";
import type { ScenarioParams } from "../types";

/**
 * Anti-mock guards for the Projection truth-source hardening.
 *
 * Proves the V2 engine no longer bakes the stable yields: a caller can inject a
 * LIVE yield and the result moves; omitting it falls back to the documented
 * default constants (never a silent live-looking value).
 */

const BASE_PARAMS: ScenarioParams = {
  btcPriceUsd: 60_000,
  networkHashrateEh: 900,
  hashpricePer100Th: 0.06,
  miningYieldPct: 0.1,
  allocationWeights: {
    mining: 0.4,
    btcTactical: 0.2,
    usdcBase: 0.3,
    stableReserve: 0.1,
  },
  durationMonths: 12,
  riskFreeRate: 0.04,
};

describe("V2 stable yields are injectable (no hardcoded mock)", () => {
  it("injected USDC yield changes the monthly usdc contribution", () => {
    const low = runScenario({ ...BASE_PARAMS, usdcAnnualYield: 0.02 });
    const high = runScenario({ ...BASE_PARAMS, usdcAnnualYield: 0.12 });
    const lowUsdc = low.monthly[0]!.usdcContrib;
    const highUsdc = high.monthly[0]!.usdcContrib;
    expect(highUsdc).toBeGreaterThan(lowUsdc);
  });

  it("omitting the yield falls back to the documented default constant", () => {
    const def = runScenario(BASE_PARAMS);
    const explicit = runScenario({
      ...BASE_PARAMS,
      usdcAnnualYield: DEFAULT_USDC_ANNUAL_YIELD,
      stableAnnualYield: DEFAULT_STABLE_ANNUAL_YIELD,
    });
    // Default path == explicitly passing the defaults → identical output.
    expect(def.monthly[0]!.usdcContrib).toBeCloseTo(
      explicit.monthly[0]!.usdcContrib,
      8,
    );
  });

  it("default constants are the conservative 4.8% / 4.5% (documented fallback)", () => {
    expect(DEFAULT_USDC_ANNUAL_YIELD).toBe(0.048);
    expect(DEFAULT_STABLE_ANNUAL_YIELD).toBe(0.045);
  });

  it("a live yield genuinely diverges from the default fallback", () => {
    const fallback = runScenario(BASE_PARAMS);
    const live = runScenario({ ...BASE_PARAMS, usdcAnnualYield: 0.09 });
    expect(live.monthly[0]!.usdcContrib).not.toBeCloseTo(
      fallback.monthly[0]!.usdcContrib,
      8,
    );
  });
});

describe("engine determinism preserved after injection", () => {
  it("same params (with injected yields) → identical result", () => {
    const p = { ...BASE_PARAMS, usdcAnnualYield: 0.07, stableAnnualYield: 0.05 };
    expect(runScenario(p)).toEqual(runScenario(p));
  });
});
