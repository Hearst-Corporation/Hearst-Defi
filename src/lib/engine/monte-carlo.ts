// Monte Carlo projection mode (methodology v2.0, ADR-006). Optional companion
// to the rule-based scenario engine — NOT a replacement. Pure: no I/O, no clock,
// no Math.random. The PRNG seed is an explicit input so a (seed, N, assumptions)
// triple is byte-reproducible and snapshot-testable (non-negotiable #6).
//
// Per path:
//   - BTC price evolves as geometric Brownian motion (drift μ, vol σ).
//   - Network difficulty follows a bounded, mean-reverting drift.
//   - Hashprice is NEVER sampled directly — it is re-derived from the sampled
//     (difficulty, BTC) via the shared hashprice formula, each step, exactly as
//     in live/backfill (methodology v2.0 §Inputs).
//   - Mining yield + a low-vol blended stable/T-bill yield → path APY.
// The headline output stays a RANGE [p25, p75]; no single-point APY is emitted
// (non-negotiable #1).

import { deriveHashpriceUsdPerThDay } from "./hashprice-formula";
import { createPrng } from "./prng";

const DEFAULT_PATHS = 10_000;

export interface BtcGbmAssumptions {
  /** Spot BTC price at t0 (USD). */
  startPriceUsd: number;
  /** Annualised drift μ (e.g. 0.15 = +15%/yr expected log-drift). */
  annualDrift: number;
  /** Annualised volatility σ (e.g. 0.6 = 60%/yr). */
  annualVol: number;
}

export interface DifficultyAssumptions {
  /** Network difficulty at t0. */
  start: number;
  /** Long-run difficulty the process mean-reverts toward. */
  longRun: number;
  /** Mean-reversion speed per year (0..n). Higher = faster pull to longRun. */
  reversionSpeed: number;
  /** Annualised volatility of the bounded difficulty step. */
  annualVol: number;
  /** Hard floor/ceiling as a multiple of `start`, bounding each step. */
  minMultiple: number;
  maxMultiple: number;
}

// Methodology v2.0 §Inputs requires "correlated Wiener increment, ρ(BTC,
// difficulty) from historical data" between the BTC GBM and the difficulty
// process. The methodology does not pin a numeric value (calibration is left to
// the trailing 36m MiningMetric window). We default to a conservative ρ=0.4
// because difficulty adjusts lagged-positively to BTC price (miners turn rigs
// on when BTC rallies, off in drawdowns). Caller can override per scenario.
const DEFAULT_BTC_DIFFICULTY_CORRELATION = 0.4;

export interface BlendedYieldAssumptions {
  /** Fraction of NAV earning mining yield (0..1). */
  miningWeight: number;
  /** Fraction earning the stable/T-bill leg (0..1). */
  stableWeight: number;
  /**
   * Fraction of NAV earning the BTC HOLDING sleeve's price return (0..1).
   * OPTIONAL — defaults to 0 so existing 2-sleeve callers (scenario engine,
   * vaults, other runQuant callers) are byte-for-byte unchanged: when it is
   * 0 (or omitted) the blend collapses back to `miningWeight·miningApy +
   * stableWeight·stableApy`, and `miningWeight + stableWeight` still sum to 1
   * exactly as before. When `btcHoldWeight > 0` the three weights MUST sum to 1
   * (asserted), and the BTC-hold leg realises the annualised BTC PRICE return of
   * each simulated GBM path (the honest HODL exposure: positive in a bull path,
   * negative in a bear path) — NOT the flat stable yield. The leg consumes NO
   * extra PRNG draw: it is derived deterministically from the same `price` path
   * the sim already evolves, so engine purity (#6) and seed-reproducibility hold.
   */
  btcHoldWeight?: number;
  /** Annualised stable/T-bill yield mean (e.g. 0.05 = 5%). */
  stableApyMean: number;
  /** Annualised stable/T-bill yield vol (low). */
  stableApyVol: number;
  /**
   * Converts mining hashprice ($/TH/day) into an annualised mining APY on the
   * mining leg. apy = (hashprice − costPerThDay) × 365 / capitalPerThUsd.
   */
  costPerThDay: number;
  capitalPerThUsd: number;
}

export interface MonteCarloInput {
  /** Explicit PRNG seed — same seed ⇒ identical output. */
  seed: number;
  /** Number of simulated paths. Defaults to 10,000. */
  paths?: number;
  /** Projection horizon in months. */
  horizonMonths: number;
  btc: BtcGbmAssumptions;
  difficulty: DifficultyAssumptions;
  yield: BlendedYieldAssumptions;
  /** Floor APY (fraction, e.g. 0.08 = 8%) for the P(apy < floor) statistic. */
  floorApy: number;
  /**
   * Correlation ρ ∈ [-1, 1] between the BTC GBM shock and the difficulty
   * shock (methodology v2.0 §Inputs). Applied via Cholesky on a 2×2
   * `[[1, ρ], [ρ, 1]]` matrix: `zDiff_corr = ρ·zBtc + √(1-ρ²)·zDiff_indep`.
   * Defaults to 0.4 (see `DEFAULT_BTC_DIFFICULTY_CORRELATION`).
   */
  btcDifficultyCorrelation?: number;
}

export interface Percentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface MonteCarloOutput {
  seed: number;
  paths: number;
  /** Empirical APY percentiles (fractions). */
  percentiles: Percentiles;
  /** Published headline range = [p25, p75]. Never a single point (#1). */
  headlineRange: { low: number; high: number };
  /** Empirical P(path APY < floorApy), in [0, 1]. */
  probBelowFloor: number;
}

const STEPS_PER_YEAR = 12;

/** Linear-interpolated percentile of a value already sorted ascending. */
function percentileSorted(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0] as number;
  const rank = q * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] as number;
  if (lo === hi) return loVal;
  const hiVal = sorted[hi] as number;
  return loVal + (hiVal - loVal) * (rank - lo);
}

/** Annualised mining APY (fraction) from a hashprice in $/TH/day. */
function miningApyFromHashprice(
  hashpriceUsdPerThDay: number,
  costPerThDay: number,
  capitalPerThUsd: number,
): number {
  if (capitalPerThUsd <= 0) return 0;
  const netPerDay = hashpriceUsdPerThDay - costPerThDay;
  return (netPerDay * 365) / capitalPerThUsd;
}

/**
 * Run the Monte Carlo simulation. Pure and deterministic in (seed, paths,
 * assumptions). Hashprice is re-derived per step from sampled (difficulty, BTC).
 */
export function runMonteCarlo(input: MonteCarloInput): MonteCarloOutput {
  const paths = Math.max(1, Math.floor(input.paths ?? DEFAULT_PATHS));
  const prng = createPrng(input.seed);

  const steps = Math.max(1, Math.round(input.horizonMonths));
  const dt = 1 / STEPS_PER_YEAR; // one step = one month, in years

  const { btc, difficulty, yield: yld } = input;

  // GBM log-step parameters (per month).
  const muStep = (btc.annualDrift - 0.5 * btc.annualVol * btc.annualVol) * dt;
  const sigmaStep = btc.annualVol * Math.sqrt(dt);

  const diffSigmaStep = difficulty.annualVol * Math.sqrt(dt);
  const diffFloor = difficulty.start * difficulty.minMultiple;
  const diffCeil = difficulty.start * difficulty.maxMultiple;

  const rhoRaw = input.btcDifficultyCorrelation ?? DEFAULT_BTC_DIFFICULTY_CORRELATION;
  const rho = Math.max(-1, Math.min(1, rhoRaw));
  const rhoComplement = Math.sqrt(Math.max(0, 1 - rho * rho));

  // BTC HOLDING sleeve weight (0 by default → 2-sleeve, backward compatible).
  // When > 0 we model the third sleeve as the path's realised BTC price return;
  // the three weights must then sum to 1 (the caller is responsible — we assert).
  const btcHoldWeight = yld.btcHoldWeight ?? 0;
  if (btcHoldWeight > 0) {
    const weightSum = yld.miningWeight + btcHoldWeight + yld.stableWeight;
    // Allow a tiny float tolerance; a real mis-spec (e.g. 1.3) still throws.
    if (Math.abs(weightSum - 1) > 1e-6) {
      throw new RangeError(
        `monte-carlo: when btcHoldWeight > 0 the three sleeve weights must sum to 1 ` +
          `(got mining=${yld.miningWeight}, btcHold=${btcHoldWeight}, stable=${yld.stableWeight}, sum=${weightSum}).`,
      );
    }
  }

  // Annualisation exponent for the BTC-hold sleeve's terminal price return
  // (12 / horizonMonths). Computed once: the leg uses the WHOLE-PATH price ratio,
  // not a per-step compounding, to avoid Jensen-inflating a single noisy monthly
  // move by ^12 (which would blow the mean far above the GBM drift).
  const annualiseExp = STEPS_PER_YEAR / steps;

  const pathApys = new Array<number>(paths);

  for (let p = 0; p < paths; p += 1) {
    const startPrice = btc.startPriceUsd;
    let price = startPrice;
    let diff = difficulty.start;
    let yieldAcc = 0;

    for (let s = 0; s < steps; s += 1) {
      const zBtc = prng.nextGaussian();
      price *= Math.exp(muStep + sigmaStep * zBtc);

      // Cholesky-correlated difficulty shock: cov(zBtc, zDiffCorr) = ρ while
      // each leg stays standard-normal (methodology v2.0 §Inputs).
      const zDiffIndep = prng.nextGaussian();
      const zDiff = rho * zBtc + rhoComplement * zDiffIndep;

      // Bounded mean-reverting difficulty (Euler step of an OU-like process).
      const pull = difficulty.reversionSpeed * (difficulty.longRun - diff) * dt;
      diff = diff + pull + diff * diffSigmaStep * zDiff;
      if (diff < diffFloor) diff = diffFloor;
      if (diff > diffCeil) diff = diffCeil;

      const hashprice = deriveHashpriceUsdPerThDay(diff, price);
      const miningApy = miningApyFromHashprice(
        hashprice,
        yld.costPerThDay,
        yld.capitalPerThUsd,
      );

      const zStable = prng.nextGaussian();
      const stableApy = yld.stableApyMean + yld.stableApyVol * zStable;

      const stepApy =
        yld.miningWeight * miningApy + yld.stableWeight * stableApy;
      yieldAcc += stepApy;
    }

    // Mining + stable legs: average annualised APY over the monthly snapshots.
    let pathApy = yieldAcc / steps;

    // BTC HOLDING sleeve: the path's TERMINAL annualised price return — the honest
    // HODL exposure (positive in a bull path, negative in a bear path). Derived
    // from the SAME GBM `price` path (no extra PRNG draw — every zBtc was already
    // consumed above), so determinism + purity hold. Added only when the leg is
    // used (weight 0 ⇒ skipped ⇒ 2-sleeve blend byte-for-byte identical to before).
    if (btcHoldWeight > 0 && startPrice > 0) {
      const btcHoldApy = Math.pow(price / startPrice, annualiseExp) - 1;
      pathApy += btcHoldWeight * btcHoldApy;
    }

    pathApys[p] = pathApy;
  }

  const sorted = pathApys.slice().sort((a, b) => a - b);

  const percentiles: Percentiles = {
    p5: percentileSorted(sorted, 0.05),
    p25: percentileSorted(sorted, 0.25),
    p50: percentileSorted(sorted, 0.5),
    p75: percentileSorted(sorted, 0.75),
    p95: percentileSorted(sorted, 0.95),
  };

  let below = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if ((sorted[i] as number) < input.floorApy) below += 1;
    else break; // sorted ascending — first non-below ends the run
  }
  const probBelowFloor = below / sorted.length;

  return {
    seed: input.seed,
    paths,
    percentiles,
    headlineRange: { low: percentiles.p25, high: percentiles.p75 },
    probBelowFloor,
  };
}
