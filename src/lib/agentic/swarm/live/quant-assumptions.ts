/**
 * Monte-Carlo assumptions for the quant swarm — calibratable inputs.
 *
 * The quant stage (D) used to hardcode the BTC drift/vol, the difficulty
 * mean-reversion, the blended weights and the amortization. This module lifts
 * those into a typed, defaulted, override-able config so the admin can CALIBRATE
 * a scenario (conservative ↔ aggressive) instead of being stuck on one set of
 * constants — without ever touching the engine's purity (the engine still
 * receives a seed and explicit numbers; nothing here calls Math.random/Date).
 *
 * Pure: no I/O. Defaults are CONFIGURED, not validated — every projection stays
 * a range and is "not guaranteed" (#1/#10). Overrides are clamped to sane bounds
 * so a crafted value can't push the simulation to a nonsense regime.
 */

export interface QuantAssumptions {
  /** Simulated paths. More = smoother percentiles, slower. */
  paths: number;
  /** Projection horizon in months. */
  horizonMonths: number;
  /** APY floor (%) for the P(apy < floor) statistic. */
  floorApyPct: number;
  btc: {
    /** Annualised drift μ (e.g. 0.10 = +10%/yr expected log-drift). */
    annualDrift: number;
    /** Annualised volatility σ (e.g. 0.60 = 60%/yr). */
    annualVol: number;
  };
  difficulty: {
    /** Mean-reversion speed per year toward the long-run multiple. */
    reversionSpeed: number;
    /** Long-run difficulty as a multiple of the current difficulty. */
    longRunMultiple: number;
    /** Annualised volatility of the bounded difficulty step. */
    annualVol: number;
    /** Hard floor/ceiling as a multiple of `start`, bounding each step. */
    minMultiple: number;
    maxMultiple: number;
  };
  yield: {
    /** Fraction of NAV on the mining leg (0..1). The stable leg is 1 − this. */
    miningWeight: number;
    /** Annualised stable/T-bill yield vol (low). */
    stableApyVol: number;
  };
  /** Months over which the machine landed cost is amortized into capital/TH. */
  amortizationMonths: number;
  /** ρ between BTC GBM and difficulty shocks (methodology v2.0). */
  btcDifficultyCorrelation: number;
}

/** CONFIGURED defaults — the previous hardcodes, now one editable place. */
export const DEFAULT_QUANT_ASSUMPTIONS: QuantAssumptions = {
  paths: 5_000,
  horizonMonths: 12,
  floorApyPct: 8,
  btc: { annualDrift: 0.1, annualVol: 0.6 },
  difficulty: {
    reversionSpeed: 0.8,
    longRunMultiple: 1.15,
    annualVol: 0.25,
    minMultiple: 0.6,
    maxMultiple: 2.0,
  },
  yield: { miningWeight: 0.6, stableApyVol: 0.01 },
  amortizationMonths: 24,
  btcDifficultyCorrelation: 0.4,
};

/** Every field optional — the admin overrides only what they calibrate. */
export interface QuantAssumptionsOverrides {
  paths?: number;
  horizonMonths?: number;
  floorApyPct?: number;
  btc?: Partial<QuantAssumptions["btc"]>;
  difficulty?: Partial<QuantAssumptions["difficulty"]>;
  yield?: Partial<QuantAssumptions["yield"]>;
  amortizationMonths?: number;
  btcDifficultyCorrelation?: number;
}

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Merge overrides onto the defaults with every field clamped to a sane range.
 * Clamping is the safety boundary: a calibration can explore conservative ↔
 * aggressive, but can never request 0 paths, a 100-year horizon, a negative vol,
 * or a correlation outside [-1, 1].
 */
export function resolveQuantAssumptions(
  overrides?: QuantAssumptionsOverrides,
): QuantAssumptions {
  const d = DEFAULT_QUANT_ASSUMPTIONS;
  const o = overrides ?? {};
  return {
    paths: Math.round(clamp(o.paths, 500, 20_000, d.paths)),
    horizonMonths: Math.round(clamp(o.horizonMonths, 1, 120, d.horizonMonths)),
    floorApyPct: clamp(o.floorApyPct, 0, 100, d.floorApyPct),
    btc: {
      annualDrift: clamp(o.btc?.annualDrift, -1, 2, d.btc.annualDrift),
      annualVol: clamp(o.btc?.annualVol, 0.01, 3, d.btc.annualVol),
    },
    difficulty: {
      reversionSpeed: clamp(
        o.difficulty?.reversionSpeed,
        0,
        5,
        d.difficulty.reversionSpeed,
      ),
      longRunMultiple: clamp(
        o.difficulty?.longRunMultiple,
        0.1,
        10,
        d.difficulty.longRunMultiple,
      ),
      annualVol: clamp(o.difficulty?.annualVol, 0.01, 2, d.difficulty.annualVol),
      minMultiple: clamp(o.difficulty?.minMultiple, 0.1, 1, d.difficulty.minMultiple),
      maxMultiple: clamp(o.difficulty?.maxMultiple, 1, 10, d.difficulty.maxMultiple),
    },
    yield: {
      miningWeight: clamp(o.yield?.miningWeight, 0, 1, d.yield.miningWeight),
      stableApyVol: clamp(o.yield?.stableApyVol, 0, 0.5, d.yield.stableApyVol),
    },
    amortizationMonths: Math.round(
      clamp(o.amortizationMonths, 6, 60, d.amortizationMonths),
    ),
    btcDifficultyCorrelation: clamp(
      o.btcDifficultyCorrelation,
      -1,
      1,
      d.btcDifficultyCorrelation,
    ),
  };
}

/** A few named presets so the admin can jump to a regime in one click. */
export const QUANT_PRESETS: Record<
  "conservative" | "base" | "aggressive",
  QuantAssumptionsOverrides
> = {
  conservative: {
    btc: { annualDrift: -0.05, annualVol: 0.75 },
    difficulty: { longRunMultiple: 1.3 },
    yield: { miningWeight: 0.4 },
  },
  base: {},
  aggressive: {
    btc: { annualDrift: 0.25, annualVol: 0.55 },
    difficulty: { longRunMultiple: 1.05 },
    yield: { miningWeight: 0.75 },
  },
};
