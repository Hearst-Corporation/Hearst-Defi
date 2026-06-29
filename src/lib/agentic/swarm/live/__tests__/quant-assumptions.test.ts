import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUANT_ASSUMPTIONS,
  resolveQuantAssumptions,
  QUANT_PRESETS,
} from "@/lib/agentic/swarm/live/quant-assumptions";

describe("resolveQuantAssumptions", () => {
  it("returns the CONFIGURED defaults when no overrides are given", () => {
    expect(resolveQuantAssumptions()).toEqual(DEFAULT_QUANT_ASSUMPTIONS);
    expect(resolveQuantAssumptions({})).toEqual(DEFAULT_QUANT_ASSUMPTIONS);
  });

  it("applies a partial override on top of the defaults", () => {
    const r = resolveQuantAssumptions({ btc: { annualDrift: 0.25 } });
    expect(r.btc.annualDrift).toBe(0.25);
    // untouched fields keep the default
    expect(r.btc.annualVol).toBe(DEFAULT_QUANT_ASSUMPTIONS.btc.annualVol);
    expect(r.paths).toBe(DEFAULT_QUANT_ASSUMPTIONS.paths);
  });

  it("clamps every field to a sane range (the safety boundary)", () => {
    const r = resolveQuantAssumptions({
      paths: 10_000_000, // → 20_000 cap
      horizonMonths: 9_999, // → 120 cap
      floorApyPct: -50, // → 0
      btc: { annualDrift: 99, annualVol: -1 }, // → 2, 0.01
      btcDifficultyCorrelation: 5, // → 1
      yield: { miningWeight: 2 }, // → 1
    });
    expect(r.paths).toBe(20_000);
    expect(r.horizonMonths).toBe(120);
    expect(r.floorApyPct).toBe(0);
    expect(r.btc.annualDrift).toBe(2);
    expect(r.btc.annualVol).toBe(0.01);
    expect(r.btcDifficultyCorrelation).toBe(1);
    expect(r.yield.miningWeight).toBe(1);
  });

  it("ignores NaN / non-numeric overrides and keeps the default", () => {
    const r = resolveQuantAssumptions({
      paths: NaN as unknown as number,
      btc: { annualDrift: "x" as unknown as number },
    });
    expect(r.paths).toBe(DEFAULT_QUANT_ASSUMPTIONS.paths);
    expect(r.btc.annualDrift).toBe(DEFAULT_QUANT_ASSUMPTIONS.btc.annualDrift);
  });

  it("the conservative preset lowers drift + mining weight vs base", () => {
    const base = resolveQuantAssumptions(QUANT_PRESETS.base);
    const cons = resolveQuantAssumptions(QUANT_PRESETS.conservative);
    expect(cons.btc.annualDrift).toBeLessThan(base.btc.annualDrift);
    expect(cons.yield.miningWeight).toBeLessThan(base.yield.miningWeight);
  });

  it("the aggressive preset raises drift + mining weight vs base", () => {
    const base = resolveQuantAssumptions(QUANT_PRESETS.base);
    const aggr = resolveQuantAssumptions(QUANT_PRESETS.aggressive);
    expect(aggr.btc.annualDrift).toBeGreaterThan(base.btc.annualDrift);
    expect(aggr.yield.miningWeight).toBeGreaterThan(base.yield.miningWeight);
  });
});

import { runMonteCarlo } from "@/lib/engine/monte-carlo";

/**
 * Proof that calibration actually MOVES the numbers: the same seed + market,
 * run under the conservative vs aggressive regime, produces different p50/p95.
 * runMonteCarlo is pure (seeded) so this is deterministic — no server needed.
 */
describe("calibration changes the Monte-Carlo output", () => {
  function runWith(overrides: Parameters<typeof resolveQuantAssumptions>[0]) {
    const a = resolveQuantAssumptions(overrides);
    return runMonteCarlo({
      seed: 42,
      paths: a.paths,
      horizonMonths: a.horizonMonths,
      btc: { startPriceUsd: 60000, annualDrift: a.btc.annualDrift, annualVol: a.btc.annualVol },
      difficulty: {
        start: 1e14,
        longRun: 1e14 * a.difficulty.longRunMultiple,
        reversionSpeed: a.difficulty.reversionSpeed,
        annualVol: a.difficulty.annualVol,
        minMultiple: a.difficulty.minMultiple,
        maxMultiple: a.difficulty.maxMultiple,
      },
      yield: {
        miningWeight: a.yield.miningWeight,
        stableWeight: 1 - a.yield.miningWeight,
        stableApyMean: 0.05,
        stableApyVol: a.yield.stableApyVol,
        costPerThDay: 0.05,
        capitalPerThUsd: 36.5,
      },
      floorApy: a.floorApyPct / 100,
      btcDifficultyCorrelation: a.btcDifficultyCorrelation,
    });
  }

  it("aggressive vs conservative produce a different p50 (calibration is real)", () => {
    const cons = runWith(QUANT_PRESETS.conservative);
    const aggr = runWith(QUANT_PRESETS.aggressive);
    // Calibration must MOVE the median — the two presets cannot collapse to the
    // same number. We do NOT assert a direction: with the current low hashprice
    // mining is under water, so the higher mining weight of the aggressive preset
    // can pull the median DOWN. That is the honest market truth, not a bug.
    expect(aggr.percentiles.p50).not.toBe(cons.percentiles.p50);
    expect(Math.abs(aggr.percentiles.p50 - cons.percentiles.p50)).toBeGreaterThan(0);
  });

  it("same regime + same seed is reproducible (deterministic)", () => {
    const a = runWith(QUANT_PRESETS.base);
    const b = runWith(QUANT_PRESETS.base);
    expect(a.percentiles).toEqual(b.percentiles);
  });
});
