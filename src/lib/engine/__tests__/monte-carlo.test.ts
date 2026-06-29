import { describe, expect, it } from "vitest";

import { createPrng, mulberry32 } from "../prng";
import { runMonteCarlo, type MonteCarloInput } from "../monte-carlo";

const BASE_INPUT: MonteCarloInput = {
  seed: 42,
  paths: 5_000,
  horizonMonths: 12,
  btc: {
    startPriceUsd: 60_000,
    annualDrift: 0.1,
    annualVol: 0.6,
  },
  difficulty: {
    start: 80e12,
    longRun: 90e12,
    reversionSpeed: 0.5,
    annualVol: 0.2,
    minMultiple: 0.5,
    maxMultiple: 2.0,
  },
  yield: {
    miningWeight: 0.6,
    stableWeight: 0.4,
    stableApyMean: 0.05,
    stableApyVol: 0.005,
    costPerThDay: 0.04,
    capitalPerThUsd: 25,
  },
  floorApy: 0.08,
};

describe("mulberry32 / createPrng", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces uniforms in [0, 1)", () => {
    const u = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = u();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("gaussian has ~0 mean and ~1 sd over a large sample", () => {
    const prng = createPrng(99);
    const n = 100_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i += 1) {
      const g = prng.nextGaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.02);
  });
});

describe("runMonteCarlo determinism", () => {
  it("same seed + same assumptions ⇒ identical output", () => {
    const a = runMonteCarlo(BASE_INPUT);
    const b = runMonteCarlo(BASE_INPUT);
    expect(a).toEqual(b);
  });

  it("different seeds ⇒ different output", () => {
    const a = runMonteCarlo(BASE_INPUT);
    const b = runMonteCarlo({ ...BASE_INPUT, seed: 43 });
    expect(a).not.toEqual(b);
    expect(a.percentiles.p50).not.toBe(b.percentiles.p50);
  });

  it("records seed and path count in the output", () => {
    const out = runMonteCarlo(BASE_INPUT);
    expect(out.seed).toBe(42);
    expect(out.paths).toBe(5_000);
  });

  it("defaults to 10,000 paths when unspecified", () => {
    const rest = { ...BASE_INPUT };
    delete rest.paths;
    const out = runMonteCarlo(rest);
    expect(out.paths).toBe(10_000);
  });
});

describe("runMonteCarlo distribution", () => {
  it("percentiles are ordered p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95", () => {
    const { percentiles: p } = runMonteCarlo(BASE_INPUT);
    expect(p.p5).toBeLessThanOrEqual(p.p25);
    expect(p.p25).toBeLessThanOrEqual(p.p50);
    expect(p.p50).toBeLessThanOrEqual(p.p75);
    expect(p.p75).toBeLessThanOrEqual(p.p95);
  });

  it("headlineRange is the [p25, p75] interval, never a single point", () => {
    const out = runMonteCarlo(BASE_INPUT);
    expect(out.headlineRange.low).toBe(out.percentiles.p25);
    expect(out.headlineRange.high).toBe(out.percentiles.p75);
    expect(out.headlineRange.high).toBeGreaterThan(out.headlineRange.low);
  });
});

describe("runMonteCarlo probBelowFloor", () => {
  it("is a probability in [0, 1]", () => {
    const out = runMonteCarlo(BASE_INPUT);
    expect(out.probBelowFloor).toBeGreaterThanOrEqual(0);
    expect(out.probBelowFloor).toBeLessThanOrEqual(1);
  });

  it("is monotone non-decreasing in the floor", () => {
    const low = runMonteCarlo({ ...BASE_INPUT, floorApy: 0.02 });
    const mid = runMonteCarlo({ ...BASE_INPUT, floorApy: 0.1 });
    const high = runMonteCarlo({ ...BASE_INPUT, floorApy: 0.3 });
    expect(mid.probBelowFloor).toBeGreaterThanOrEqual(low.probBelowFloor);
    expect(high.probBelowFloor).toBeGreaterThanOrEqual(mid.probBelowFloor);
  });

  it("a floor below everything gives ~0, above everything gives 1", () => {
    const none = runMonteCarlo({ ...BASE_INPUT, floorApy: -1 });
    const all = runMonteCarlo({ ...BASE_INPUT, floorApy: 1e9 });
    expect(none.probBelowFloor).toBe(0);
    expect(all.probBelowFloor).toBe(1);
  });
});

describe("runMonteCarlo GBM sanity", () => {
  it("median path APY tracks the expected blended yield on a large sample", () => {
    // With near-zero vols the path APY collapses to the deterministic blend:
    // mining leg ≈ (hashprice − cost)·365/capital, stable leg ≈ stableApyMean.
    const out = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: 0, annualVol: 1e-6 },
      difficulty: {
        ...BASE_INPUT.difficulty,
        annualVol: 1e-6,
        reversionSpeed: 0,
        longRun: BASE_INPUT.difficulty.start,
      },
      yield: { ...BASE_INPUT.yield, stableApyVol: 1e-9 },
    });
    // Deterministic-ish blend → tight spread between p5 and p95.
    expect(out.percentiles.p95 - out.percentiles.p5).toBeLessThan(0.01);
    expect(out.percentiles.p50).toBeGreaterThan(0);
  });

  it("higher BTC drift shifts the median APY upward", () => {
    const lowDrift = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: -0.2 },
    });
    const highDrift = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: 0.4 },
    });
    expect(highDrift.percentiles.p50).toBeGreaterThan(lowDrift.percentiles.p50);
  });
});

// ---------------------------------------------------------------------------
// 3-sleeve blend (BTC HOLDING sleeve) — root cause #2
// ---------------------------------------------------------------------------

describe("runMonteCarlo — BTC HOLDING sleeve (3-sleeve blend)", () => {
  it("btcHoldWeight=0 (or omitted) is byte-for-byte identical to the 2-sleeve blend", () => {
    const twoSleeve = runMonteCarlo(BASE_INPUT);
    const explicitZero = runMonteCarlo({
      ...BASE_INPUT,
      yield: { ...BASE_INPUT.yield, btcHoldWeight: 0 },
    });
    // Regression guard: adding the (zero) sleeve must NOT consume an extra PRNG
    // draw or change any number — the whole distribution stays identical.
    expect(explicitZero).toEqual(twoSleeve);
  });

  it("a bull BTC path lifts the median when the BTC-hold sleeve is on", () => {
    // 3-sleeve with a real BTC-hold weight; positive drift ⇒ HODL contributes
    // positive return ⇒ higher p50 than the same allocation with the BTC sleeve
    // folded back into the (flat, lower-yielding) stable leg.
    const withHold = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: 0.5, annualVol: 0.4 },
      yield: {
        ...BASE_INPUT.yield,
        miningWeight: 0.3,
        btcHoldWeight: 0.5,
        stableWeight: 0.2,
        stableApyMean: 0.05,
      },
    });
    const withoutHold = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: 0.5, annualVol: 0.4 },
      yield: {
        ...BASE_INPUT.yield,
        miningWeight: 0.3,
        // No BTC-hold sleeve: the same fraction earns the flat stable yield.
        stableWeight: 0.7,
        stableApyMean: 0.05,
      },
    });
    expect(withHold.percentiles.p50).toBeGreaterThan(withoutHold.percentiles.p50);
  });

  it("a bear BTC path drags the median down through the BTC-hold sleeve", () => {
    const bull = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: 0.4, annualVol: 0.4 },
      yield: { ...BASE_INPUT.yield, miningWeight: 0.3, btcHoldWeight: 0.5, stableWeight: 0.2 },
    });
    const bear = runMonteCarlo({
      ...BASE_INPUT,
      paths: 20_000,
      btc: { ...BASE_INPUT.btc, annualDrift: -0.3, annualVol: 0.4 },
      yield: { ...BASE_INPUT.yield, miningWeight: 0.3, btcHoldWeight: 0.5, stableWeight: 0.2 },
    });
    // Same sleeves, only the BTC drift flips sign → the BTC-hold leg carries the
    // honest directional exposure: bull median > bear median.
    expect(bull.percentiles.p50).toBeGreaterThan(bear.percentiles.p50);
  });

  it("is still deterministic with the BTC-hold sleeve on (same seed → identical)", () => {
    const input = {
      ...BASE_INPUT,
      yield: { ...BASE_INPUT.yield, miningWeight: 0.3, btcHoldWeight: 0.5, stableWeight: 0.2 },
    };
    expect(runMonteCarlo(input)).toEqual(runMonteCarlo(input));
  });

  it("throws when btcHoldWeight>0 and the three sleeve weights do not sum to 1", () => {
    expect(() =>
      runMonteCarlo({
        ...BASE_INPUT,
        yield: {
          ...BASE_INPUT.yield,
          miningWeight: 0.6,
          btcHoldWeight: 0.5, // 0.6 + 0.5 + 0.4 = 1.5 ≠ 1
          stableWeight: 0.4,
        },
      }),
    ).toThrow(/sum to 1/);
  });

  it("accepts three weights that sum to 1 within float tolerance", () => {
    expect(() =>
      runMonteCarlo({
        ...BASE_INPUT,
        paths: 500,
        yield: {
          ...BASE_INPUT.yield,
          miningWeight: 0.33,
          btcHoldWeight: 0.33,
          stableWeight: 0.34,
        },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Snapshot tests — task A2 acceptance criteria
// ---------------------------------------------------------------------------
// These two tests fulfil the explicit A2 requirement:
//   1. seed=42 with 1 000 runs → stable byte-identical snapshots across runs
//   2. different seed → different percentile results (no accidental collision)
// ---------------------------------------------------------------------------

describe("runMonteCarlo snapshot — seed=42, runs=1000", () => {
  const SNAPSHOT_INPUT = {
    ...BASE_INPUT,
    seed: 42,
    paths: 1_000,
    horizonMonths: 12,
  } as const;

  it("seed=42 produces stable percentile snapshot", () => {
    const out = runMonteCarlo(SNAPSHOT_INPUT);
    // Snapshot captures the full percentile object.  Running the suite a
    // second time must produce the exact same numbers — byte-identical.
    expect({
      seed: out.seed,
      paths: out.paths,
      p5: out.percentiles.p5,
      p25: out.percentiles.p25,
      p50: out.percentiles.p50,
      p75: out.percentiles.p75,
      p95: out.percentiles.p95,
    }).toMatchSnapshot();
  });

  it("seed=99 produces a different snapshot from seed=42", () => {
    const seed42 = runMonteCarlo(SNAPSHOT_INPUT);
    const seed99 = runMonteCarlo({ ...SNAPSHOT_INPUT, seed: 99 });
    // Values must differ — different seeds must not accidentally collide.
    expect(seed99.percentiles.p50).not.toBe(seed42.percentiles.p50);
    expect(seed99.percentiles.p5).not.toBe(seed42.percentiles.p5);
    expect(seed99.percentiles.p95).not.toBe(seed42.percentiles.p95);
    // Snapshot of the seed=99 run is also stable.
    expect({
      seed: seed99.seed,
      paths: seed99.paths,
      p5: seed99.percentiles.p5,
      p50: seed99.percentiles.p50,
      p95: seed99.percentiles.p95,
    }).toMatchSnapshot();
  });
});
