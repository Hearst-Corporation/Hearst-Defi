// Stress harness for the pure scenario engine: determinism + purity across all
// five presets, on BOTH engine surfaces that the public `runScenario` /
// `runMonteCarlo` APIs expose.
//
//   1. Rule-based V1 path — `runScenario(getPresetInputs(preset), { preset, now })`
//      → ScenarioOutput { apy_range: { low, high }, ... }. No PRNG; determinism
//      comes from fixed inputs + an injected clock (`now`). The "fixed injected
//      seed" for this path is the deterministic input set itself.
//
//   2. Seeded Monte Carlo path — `runMonteCarlo({ seed, ... })` →
//      MonteCarloOutput { headlineRange: { low, high }, ... }. Here a real
//      explicit PRNG seed exists; same seed ⇒ byte-identical output.
//
// Asserted per preset:
//   (a) DETERMINISM — running twice yields byte-identical (JSON-equal) output.
//   (b) RANGE — APY is a band (low < high), never a single point (#1).
//   (c) NO CLOCK / NO Math.random LEAK — output is stable across repeated calls
//       even when Date.now() / Math.random() are monkey-patched to change every
//       invocation. A leak would surface as drift between calls.
//
// Non-determinism for a fixed seed/input is a P0 violation of engine purity
// (non-negotiables #6 / #7).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPresetInputs, runScenario } from "../scenario";
import { runMonteCarlo, type MonteCarloInput } from "../monte-carlo";
import type { Preset, ScenarioInputs } from "../types";

const PRESETS: Preset[] = [
  "base",
  "btc_bear",
  "btc_bull",
  "mining_compression",
  "extreme_stress",
];

// Injected clock for the rule-based path. Fixing it removes the only legitimate
// time dependency (the `generated_at` assumption line) from the comparison.
const FIXED_NOW = new Date("2026-01-01T00:00:00Z");

// Fixed PRNG seed for the Monte Carlo path. Same seed ⇒ identical stream.
const FIXED_SEED = 1_234_567;

// Keep path count small so the suite stays fast while still exercising the PRNG
// stream length across the horizon.
const MC_PATHS = 256;

// Per-preset Monte Carlo assumptions, derived deterministically from each
// preset's ScenarioInputs so every preset drives a distinct, reproducible run.
function mcInputForPreset(preset: Preset, inputs: ScenarioInputs): MonteCarloInput {
  return {
    seed: FIXED_SEED,
    paths: MC_PATHS,
    horizonMonths: 12,
    btc: {
      startPriceUsd: 60_000,
      // map the preset's 30d BTC move onto an annual drift proxy
      annualDrift: (inputs.btc_price_change_pct / 100) * 0.5,
      // map the vol index (0-100) onto an annualised vol
      annualVol: Math.max(0.1, inputs.vol_index / 100),
    },
    difficulty: {
      start: 90_000_000_000_000,
      longRun: 95_000_000_000_000,
      reversionSpeed: 0.5,
      annualVol: 0.2,
      minMultiple: 0.5,
      maxMultiple: 2.0,
    },
    yield: {
      miningWeight: 0.6,
      stableWeight: 0.4,
      stableApyMean: inputs.stable_apy_pct / 100,
      stableApyVol: 0.005,
      costPerThDay: inputs.energy_cost_kwh,
      capitalPerThUsd: 20,
    },
    floorApy: 0.08,
  };
}

// Stable, order-independent serialization for byte-identity comparison.
function canon(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    typeof v === "number" && Object.is(v, -0) ? 0 : v,
  );
}

describe("stress: rule-based engine determinism + purity across presets", () => {
  let realNow: typeof Date.now;
  let realRandom: typeof Math.random;

  beforeEach(() => {
    realNow = Date.now;
    realRandom = Math.random;
  });

  afterEach(() => {
    Date.now = realNow;
    Math.random = realRandom;
  });

  for (const preset of PRESETS) {
    it(`[${preset}] is byte-identical across two runs with the same inputs`, () => {
      const inputs = getPresetInputs(preset);
      const a = runScenario(inputs, { preset, now: FIXED_NOW });
      const b = runScenario(getPresetInputs(preset), { preset, now: FIXED_NOW });
      expect(canon(a)).toBe(canon(b));
    });

    it(`[${preset}] emits an APY RANGE (low < high), never a single point`, () => {
      const out = runScenario(getPresetInputs(preset), {
        preset,
        now: FIXED_NOW,
      });
      expect(Number.isFinite(out.apy_range.low)).toBe(true);
      expect(Number.isFinite(out.apy_range.high)).toBe(true);
      expect(out.apy_range.low).toBeLessThan(out.apy_range.high);
    });

    it(`[${preset}] does NOT leak Date.now()/Math.random() (stable when patched)`, () => {
      // Make the ambient clock and RNG move on every read. A pure engine must
      // ignore both: output stays identical regardless of these mutations.
      let tick = 0;
      Date.now = () => {
        tick += 1_000;
        return 1_700_000_000_000 + tick;
      };
      let r = 0;
      Math.random = () => {
        r = (r + 0.137) % 1;
        return r;
      };

      const inputs = getPresetInputs(preset);
      const first = runScenario(inputs, { preset, now: FIXED_NOW });
      const second = runScenario(getPresetInputs(preset), {
        preset,
        now: FIXED_NOW,
      });
      const third = runScenario(getPresetInputs(preset), {
        preset,
        now: FIXED_NOW,
      });

      const s = canon(first);
      expect(canon(second)).toBe(s);
      expect(canon(third)).toBe(s);
    });
  }
});

describe("stress: seeded Monte Carlo determinism + purity across presets", () => {
  let realNow: typeof Date.now;
  let realRandom: typeof Math.random;

  beforeEach(() => {
    realNow = Date.now;
    realRandom = Math.random;
  });

  afterEach(() => {
    Date.now = realNow;
    Math.random = realRandom;
  });

  for (const preset of PRESETS) {
    it(`[${preset}] same seed ⇒ byte-identical Monte Carlo output`, () => {
      const cfg = mcInputForPreset(preset, getPresetInputs(preset));
      const a = runMonteCarlo(cfg);
      const b = runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset)));
      expect(canon(a)).toBe(canon(b));
      expect(a.seed).toBe(FIXED_SEED);
    });

    it(`[${preset}] Monte Carlo headline is a RANGE (low < high)`, () => {
      const out = runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset)));
      expect(Number.isFinite(out.headlineRange.low)).toBe(true);
      expect(Number.isFinite(out.headlineRange.high)).toBe(true);
      expect(out.headlineRange.low).toBeLessThan(out.headlineRange.high);
      // p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95 — monotone percentile band, never collapsed.
      const p = out.percentiles;
      expect(p.p5).toBeLessThanOrEqual(p.p25);
      expect(p.p25).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p75);
      expect(p.p75).toBeLessThanOrEqual(p.p95);
    });

    it(`[${preset}] Monte Carlo does NOT leak Date.now()/Math.random()`, () => {
      let tick = 0;
      Date.now = () => {
        tick += 1_000;
        return 1_700_000_000_000 + tick;
      };
      let r = 0;
      Math.random = () => {
        r = (r + 0.137) % 1;
        return r;
      };

      const out1 = runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset)));
      const out2 = runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset)));
      const out3 = runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset)));
      const s = canon(out1);
      expect(canon(out2)).toBe(s);
      expect(canon(out3)).toBe(s);
    });
  }

  it("different presets produce distinct Monte Carlo bands (sanity, no collapse)", () => {
    const bands = PRESETS.map((preset) =>
      canon(runMonteCarlo(mcInputForPreset(preset, getPresetInputs(preset))).headlineRange),
    );
    const unique = new Set(bands);
    // At least some presets must diverge — a single identical band for all five
    // would mean inputs are not flowing through the engine.
    expect(unique.size).toBeGreaterThan(1);
  });
});
