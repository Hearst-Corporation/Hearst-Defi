/**
 * Vault Monte Carlo (sandbox, /portfolio/preview) — a SIMPLE, DEFENSIBLE, HONEST 36-month
 * outlook for the single-client Hearst Yield Vault. It answers ONE question: "how likely is
 * the strategy to stay safe (no liquidation) and preserve/create value over the horizon?"
 *
 * PURE + DETERMINISTIC (non-negotiable #6 + methodology v2.0 §Determinism). The only source of
 * randomness is the injected seed via `createPrng(seed)` — NO `Math.random`, NO `Date.now`. The
 * same (seed, paths, horizonMonths) triple yields byte-identical output, so this is snapshottable.
 *
 * It reuses the shipped engine primitives rather than re-implementing them:
 *   • `createPrng` — the mulberry32 + Box-Muller stream the engine's own MC uses.
 *   • `deriveHashpriceUsdPerThDay` — the ONE hashprice formula (live, backfill and MC all share it),
 *     so mining revenue is never sampled directly; it is re-derived each step from (difficulty, price).
 *   • `runMonteCarlo` — the engine's APY simulation, called once (unmodified) purely to source the
 *     engine-backed p25/p75 APY range for the `apyRange` KPI (headline stays a RANGE, non-negotiable #1).
 *
 * Anchors come from the read-only mock (they already exist on `main`): deposit $500k, BTC-collateral
 * sleeve $216k, live Morpho LLTV 86%. EVERYTHING here is Estimated / simulated — not a forecast.
 *
 * ── MODEL (each assumption documented, deliberately simple + defensible) ─────────────────────────
 * Deposit $500k is deployed into three sleeves that reconcile to the deposit exactly (t0 equity = $500k):
 *   1. BTC-collateral sleeve — $216k held as BTC (216k / startPrice units). Marks to the price path;
 *      it IS the Morpho collateral behind any borrow.
 *   2. USDC sleeve — $115k earning a low blended stable / T-bill APY (~4.5% ± small vol), compounded.
 *   3. Mining-power principal — the residual $169k (= 500k − 216k − 115k) buys the allocated hashrate
 *      (the RWA NFT). It is carried at BOOK and depreciates linearly toward a residual over the horizon
 *      (hardware wears out — an honest drag), and it PRODUCES the mining accrual stream below. This
 *      reconciliation (the mock's two named sleeves 216k+115k don't sum to the 500k deposit; the missing
 *      169k is exactly the mining-power pocket) makes starting equity = deposit, so `safetyProbability`
 *      (P(ending ≥ deposit)) is meaningful rather than starting 34% underwater. ESTIMATED.
 *
 * Per month, per path:
 *   • BTC price → geometric Brownian motion (drift μ≈12%/yr, vol σ≈55%/yr). Median BTC ends BELOW spot
 *     at this vol (lognormal mean > median) — an honest reason the MEDIAN vault outcome stays modest
 *     while the MEAN is pulled up by bull paths.
 *   • Network difficulty → bounded, mean-reverting drift toward a long-run slightly ABOVE start
 *     (hashrate keeps arriving → hashprice compresses over time), exactly like the engine's MC.
 *   • Hashprice → re-derived from (difficulty, price) each step. When gross mining (hashprice × allocated
 *     TH × ~30 days) covers electricity the rigs run and net (gross − electricity) adds to accrual; when
 *     mining goes underwater the operator CURTAILS (the mock's "curtailed" uptime segment) — rigs off,
 *     only a small standby opex is paid that month, no production. Any monthly shortfall (standby cost, or
 *     a thin electricity gap) is funded buffer-first — from accrued cash, then the USDC sleeve — and only
 *     the remainder is a modest USDC BORROW against the BTC collateral (borrowRate ≈ 9%/yr), matching the
 *     mock's "USDC funds electricity first, borrow rule stays untriggered".
 *   • Take-profit expiry → the vault is a fixed-upside structured product: once running equity reaches the
 *     +24% take-profit target ($620k) it EXPIRES and returns capital at +24% (mock: takeProfitTargetUsdc).
 *     Modeling this caps each path's upside at the target — faithful to the product, and it keeps the mean
 *     honest instead of letting a fat GBM tail imply an unbounded HODL the vault never actually holds.
 *   • Margin call — LTV_t = debt_t / collateralValue_t. If it ever exceeds the live LLTV (0.86) the path
 *     is flagged margin-called and liquidated: collateral worth debt×(1+liquidation incentive) is seized
 *     (the incentive is the honest haircut to ending equity), debt is closed, the sleeve continues smaller.
 *
 * endingEquity = terminal BTC-sleeve value + USDC sleeve (compounded) + mining book residual
 *              + mining accrual − residual debt  (floored at 0; a holder's equity can't go negative),
 *              or exactly the take-profit target on a path that expired.
 *
 * Statistics: percentiles are linear-interpolated on the sorted ending equities (same routine as the
 * engine); expected = mean; safetyProbability = share ≥ deposit; marginCallProbability = share flagged
 * (kept a small, non-zero, honest number under these assumptions); ~20 histogram bins span [min, max].
 */
import { deriveHashpriceUsdPerThDay } from "@/lib/engine/hashprice-formula";
import { runMonteCarlo } from "@/lib/engine/monte-carlo";
import { createPrng } from "@/lib/engine/prng";

import { HEALTH, VAULT } from "./mock";

// ── Defaults (stable for demos) ───────────────────────────────────────────────
const DEFAULT_SEED = 20260709;
const DEFAULT_PATHS = 5000;
const DEFAULT_HORIZON_MONTHS = 36;
const HISTOGRAM_BINS = 20;

// ── BTC price process (GBM) — ESTIMATED ───────────────────────────────────────
/** Reference spot BTC (USD) at t0. Hard-coded anchor for the sandbox (prod would read the live oracle). */
const START_PRICE_USD = 96_000;
const BTC_ANNUAL_DRIFT = 0.12; // μ — modest +12%/yr expected log-drift
const BTC_ANNUAL_VOL = 0.55; // σ — 55%/yr, in line with realised BTC vol

// ── Network difficulty process (bounded mean-reversion) — ESTIMATED ───────────
/** t0 difficulty (~130 T) chosen so the derived hashprice ≈ the mock's ~$46/PH·day. */
const DIFFICULTY_START = 1.3e14;
const DIFFICULTY_LONG_RUN = 1.45e14; // drifts up ~11% → hashprice compresses over the horizon
const DIFFICULTY_REVERSION = 0.5; // pull-to-long-run speed / yr
const DIFFICULTY_ANNUAL_VOL = 0.35;
const DIFFICULTY_MIN_MULTIPLE = 0.5; // bound each step to [0.5×, 2.5×] of start
const DIFFICULTY_MAX_MULTIPLE = 2.5;

// ── Sleeves (reconcile to the $500k deposit) — ESTIMATED ──────────────────────
const DEPOSIT_USD = VAULT.depositUsdc; // 500_000 (mock anchor)
const BTC_SLEEVE_USD = HEALTH.collateralBtcUsdc; // 216_000 (mock anchor) — the Morpho collateral
const USDC_SLEEVE_USD = 115_000; // B3 productive USDC pocket
/** Residual pocket buys the hashrate NFT (RWA), carried at book — see file header reconciliation. */
const MINING_PRINCIPAL_USD = DEPOSIT_USD - BTC_SLEEVE_USD - USDC_SLEEVE_USD; // 169_000
const BTC_UNITS = BTC_SLEEVE_USD / START_PRICE_USD; // 2.25 BTC behind the collateral
/** +24% take-profit target (mock anchor). Reaching it EXPIRES the vault → path caps at this value. */
const TAKE_PROFIT_TARGET_USD = VAULT.takeProfitTargetUsdc; // 620_000

/** Allocated hashrate (13.0 PH/s → 13,000 TH/s), from VAULT.allocatedHashrate. */
const ALLOCATED_THS = 13_000;
const DAYS_PER_MONTH = 30;
/** Unit electricity + opex ($/TH/day) — tuned so t0 net mining ≈ +$3.7k/mo (modest, positive). ESTIMATED. */
const COST_PER_TH_DAY = 0.037;
/** Curtailment: when mining is underwater the rigs go OFF and only this fraction of the bill (standby
 *  hosting/opex) is still owed that month — the honest mitigant behind a small, non-zero margin-call rate. */
const STANDBY_COST_FRACTION = 0.35;
/** Mining hardware retains ~72% of book at 36m (≈10%/yr straight-line depreciation). ESTIMATED. */
const MINING_RESIDUAL_FRACTION = 0.72;

// ── Stable / T-bill leg on the USDC sleeve — ESTIMATED ────────────────────────
const STABLE_APY_MEAN = 0.045;
const STABLE_APY_VOL = 0.01;

// ── Borrow / liquidation — ESTIMATED ──────────────────────────────────────────
const BORROW_RATE_ANNUAL = 0.09;
const LLTV = HEALTH.lltvLivePct / 100; // 0.86 (mock anchor — live Morpho wall)
/** Morpho-style liquidation incentive seized on top of the debt when the wall is breached. */
const LIQUIDATION_PENALTY = 0.09;

/** Floor APY (fraction) for the engine-backed APY range — low end of the 8–15% product target. */
const FLOOR_APY = 0.08;
/** Blend weights for the engine APY call (must sum to 1): btcHold 216k, mining 169k, stable 115k of 500k. */
const ENGINE_BTC_HOLD_WEIGHT = BTC_SLEEVE_USD / DEPOSIT_USD; // 0.432
const ENGINE_STABLE_WEIGHT = USDC_SLEEVE_USD / DEPOSIT_USD; // 0.23
const ENGINE_MINING_WEIGHT = 1 - ENGINE_BTC_HOLD_WEIGHT - ENGINE_STABLE_WEIGHT; // 0.338
/** Effective mining capital per TH for the engine's APY formula (tempers the mining leg). ESTIMATED. */
const ENGINE_CAPITAL_PER_TH_USD = 30;

const STEPS_PER_YEAR = 12;

export interface McBin {
  /** Bin lower edge (ending-equity USD). */
  x0: number;
  /** Bin upper edge (ending-equity USD). */
  x1: number;
  /** Paths whose ending equity fell in [x0, x1). */
  count: number;
}

export interface VaultMcResult {
  seed: number;
  paths: number;
  horizonMonths: number;
  startingEquityUsd: number;
  /** P(ending equity ≥ starting deposit) — "preserves / creates value". Fraction [0, 1]. */
  safetyProbability: number;
  /** P(a path ever breaches the Morpho LLTV wall). Fraction [0, 1]. */
  marginCallProbability: number;
  /** p50 ending equity (USD). */
  medianEndingEquityUsd: number;
  /** Mean ending equity (USD). */
  expectedEndingEquityUsd: number;
  /** p10 ending equity (USD). */
  p10EndingEquityUsd: number;
  /** p90 ending equity (USD). */
  p90EndingEquityUsd: number;
  /** p5 ending equity (USD) — the worst-5% outcome. */
  worst5EndingEquityUsd: number;
  /** Engine-backed p25/p75 APY, in PERCENT. */
  apyRange: { lowPct: number; highPct: number };
  /** ~20 bins spanning [min, max] ending equity. */
  histogram: readonly McBin[];
}

/** Linear-interpolated percentile of a value already sorted ascending (same routine as the engine MC). */
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

/** ~20 evenly-spaced bins over [min, max] of the sorted ending equities, with path counts. */
function buildHistogram(sorted: readonly number[], bins: number): McBin[] {
  const n = sorted.length;
  if (n === 0) return [];
  const min = sorted[0] as number;
  const max = sorted[n - 1] as number;
  // Degenerate spread → a single bin holding every path (avoids a divide-by-zero width).
  if (max <= min) {
    return [{ x0: min, x1: min, count: n }];
  }
  const width = (max - min) / bins;
  const out: McBin[] = Array.from({ length: bins }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }));
  for (let i = 0; i < n; i += 1) {
    const v = sorted[i] as number;
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1; // the max value lands in the last bin
    (out[idx] as McBin).count += 1;
  }
  return out;
}

/** Engine-backed p25/p75 APY range (in %), sourced from the unmodified engine MC. */
function engineApyRange(seed: number, paths: number, horizonMonths: number): { lowPct: number; highPct: number } {
  const out = runMonteCarlo({
    seed,
    paths,
    horizonMonths,
    btc: {
      startPriceUsd: START_PRICE_USD,
      annualDrift: BTC_ANNUAL_DRIFT,
      annualVol: BTC_ANNUAL_VOL,
    },
    difficulty: {
      start: DIFFICULTY_START,
      longRun: DIFFICULTY_LONG_RUN,
      reversionSpeed: DIFFICULTY_REVERSION,
      annualVol: DIFFICULTY_ANNUAL_VOL,
      minMultiple: DIFFICULTY_MIN_MULTIPLE,
      maxMultiple: DIFFICULTY_MAX_MULTIPLE,
    },
    yield: {
      miningWeight: ENGINE_MINING_WEIGHT,
      stableWeight: ENGINE_STABLE_WEIGHT,
      btcHoldWeight: ENGINE_BTC_HOLD_WEIGHT,
      stableApyMean: STABLE_APY_MEAN,
      stableApyVol: STABLE_APY_VOL,
      costPerThDay: COST_PER_TH_DAY,
      capitalPerThUsd: ENGINE_CAPITAL_PER_TH_USD,
    },
    floorApy: FLOOR_APY,
  });
  return { lowPct: out.headlineRange.low * 100, highPct: out.headlineRange.high * 100 };
}

/**
 * Run the vault Monte Carlo. Pure + deterministic in (seed, paths, horizonMonths): the only randomness
 * is the seeded PRNG, so the same inputs always return the same result.
 */
export function runVaultMonteCarlo(opts?: {
  seed?: number;
  paths?: number;
  horizonMonths?: number;
}): VaultMcResult {
  const seed = opts?.seed ?? DEFAULT_SEED;
  const paths = Math.max(1, Math.floor(opts?.paths ?? DEFAULT_PATHS));
  const horizonMonths = Math.max(1, Math.round(opts?.horizonMonths ?? DEFAULT_HORIZON_MONTHS));

  const prng = createPrng(seed);
  const dt = 1 / STEPS_PER_YEAR;

  // GBM log-step (per month).
  const muStep = (BTC_ANNUAL_DRIFT - 0.5 * BTC_ANNUAL_VOL * BTC_ANNUAL_VOL) * dt;
  const sigmaStep = BTC_ANNUAL_VOL * Math.sqrt(dt);

  // Bounded mean-reverting difficulty step (Euler OU), matching the engine's MC.
  const diffSigmaStep = DIFFICULTY_ANNUAL_VOL * Math.sqrt(dt);
  const diffFloor = DIFFICULTY_START * DIFFICULTY_MIN_MULTIPLE;
  const diffCeil = DIFFICULTY_START * DIFFICULTY_MAX_MULTIPLE;

  const borrowRateMonthly = BORROW_RATE_ANNUAL / STEPS_PER_YEAR;
  const elecCostMonth = COST_PER_TH_DAY * ALLOCATED_THS * DAYS_PER_MONTH;
  const miningResidualUsd = MINING_PRINCIPAL_USD * MINING_RESIDUAL_FRACTION;

  const endingEquities = new Array<number>(paths);
  let marginCalledCount = 0;

  for (let p = 0; p < paths; p += 1) {
    let price = START_PRICE_USD;
    let diff = DIFFICULTY_START;
    let usdc = USDC_SLEEVE_USD;
    let miningAccrual = 0;
    let debt = 0;
    let btcUnits = BTC_UNITS;
    let marginCalled = false;
    let expired = false;

    for (let s = 0; s < horizonMonths; s += 1) {
      // BTC price (GBM).
      const zBtc = prng.nextGaussian();
      price *= Math.exp(muStep + sigmaStep * zBtc);

      // Difficulty (bounded mean-reverting) — independent shock (simple + defensible).
      const zDiff = prng.nextGaussian();
      const pull = DIFFICULTY_REVERSION * (DIFFICULTY_LONG_RUN - diff) * dt;
      diff = diff + pull + diff * diffSigmaStep * zDiff;
      if (diff < diffFloor) diff = diffFloor;
      if (diff > diffCeil) diff = diffCeil;

      // Mining net for the month — hashprice RE-DERIVED (never sampled) from (difficulty, price).
      // Profitable → run the rigs (net = gross − electricity). Underwater → CURTAIL: rigs off, no
      // production, only a small standby opex owed (the honest mitigant that keeps margin calls rare).
      const hashprice = deriveHashpriceUsdPerThDay(diff, price);
      const grossMining = hashprice * ALLOCATED_THS * DAYS_PER_MONTH;
      const net =
        grossMining >= elecCostMonth
          ? grossMining - elecCostMonth
          : -STANDBY_COST_FRACTION * elecCostMonth;

      // Debt accrues interest first.
      if (debt > 0) debt *= 1 + borrowRateMonthly;

      if (net >= 0) {
        // Positive month → deleverage first, remainder accrues.
        if (debt > 0) {
          const repay = Math.min(debt, net);
          debt -= repay;
          miningAccrual += net - repay;
        } else {
          miningAccrual += net;
        }
      } else {
        // Shortfall → fund BUFFER-FIRST (accrued cash, then the USDC sleeve), borrow only the remainder.
        let shortfall = -net;
        const fromAccrual = Math.min(miningAccrual, shortfall);
        miningAccrual -= fromAccrual;
        shortfall -= fromAccrual;
        if (shortfall > 0) {
          const fromUsdc = Math.min(usdc, shortfall);
          usdc -= fromUsdc;
          shortfall -= fromUsdc;
        }
        if (shortfall > 0) debt += shortfall; // last resort: USDC borrow against BTC collateral
      }

      // USDC sleeve compounds at the blended stable/T-bill rate.
      const zStable = prng.nextGaussian();
      const monthlyStable = (STABLE_APY_MEAN + STABLE_APY_VOL * zStable) / STEPS_PER_YEAR;
      usdc *= 1 + monthlyStable;

      // Margin check on the BTC collateral against the live LLTV wall.
      const collateralValue = btcUnits * price;
      if (collateralValue > 0 && debt / collateralValue > LLTV) {
        marginCalled = true;
        // Liquidation: seize collateral worth debt × (1 + incentive); the incentive is the honest haircut.
        const seizeUnits = Math.min(btcUnits, (debt * (1 + LIQUIDATION_PENALTY)) / price);
        btcUnits -= seizeUnits;
        debt = 0;
      }

      // Take-profit expiry: mining book depreciates linearly toward its residual over the horizon; once
      // running equity reaches the +24% target the vault expires and the path caps at the target.
      const miningBook =
        MINING_PRINCIPAL_USD * (1 - (1 - MINING_RESIDUAL_FRACTION) * ((s + 1) / horizonMonths));
      const runningEquity = btcUnits * price + usdc + miningBook + miningAccrual - debt;
      if (runningEquity >= TAKE_PROFIT_TARGET_USD) {
        expired = true;
        break;
      }
    }

    let endingEquity = expired
      ? TAKE_PROFIT_TARGET_USD
      : btcUnits * price + usdc + miningResidualUsd + miningAccrual - debt;
    if (endingEquity < 0) endingEquity = 0; // a holder's equity can't go below zero
    endingEquities[p] = endingEquity;
    if (marginCalled) marginCalledCount += 1;
  }

  const sorted = endingEquities.slice().sort((a, b) => a - b);
  const mean = endingEquities.reduce((acc, v) => acc + v, 0) / paths;

  let safeCount = 0;
  for (let i = 0; i < paths; i += 1) {
    if ((endingEquities[i] as number) >= DEPOSIT_USD) safeCount += 1;
  }

  return {
    seed,
    paths,
    horizonMonths,
    startingEquityUsd: DEPOSIT_USD,
    safetyProbability: safeCount / paths,
    marginCallProbability: marginCalledCount / paths,
    medianEndingEquityUsd: percentileSorted(sorted, 0.5),
    expectedEndingEquityUsd: mean,
    p10EndingEquityUsd: percentileSorted(sorted, 0.1),
    p90EndingEquityUsd: percentileSorted(sorted, 0.9),
    worst5EndingEquityUsd: percentileSorted(sorted, 0.05),
    apyRange: engineApyRange(seed, paths, horizonMonths),
    histogram: buildHistogram(sorted, HISTOGRAM_BINS),
  };
}
