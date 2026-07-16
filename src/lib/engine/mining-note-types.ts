// Interfaces for the v3.0 mining-note projection (methodology v3.0.md).
//
// The product is a BTC-ACCUMULATION mining note, NOT a distributed-yield vault.
// There is no fixed APY, no periodic cash distribution, no 4-sleeve model here.
// Three on-chain pockets (B1 Mining 40% / B2 BTC Pouch 27% / B3 Reserve 33%)
// accumulate Bitcoin over a 24-month term, delivered at maturity. The headline
// output is a RANGE of accumulated BTC (non-negotiable #1), never a single point,
// carrying `estimated` provenance (methodology §3, §7).

import type { Provenance } from "./vaults";

// ── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Take-profit tier — a CONFIGURED price target at which a fraction of the B2 BTC
 * pouch is realised to USDC and locked into B3 (methodology §5.1,
 * `setTakeProfitTier`). A realisation event, not a distribution to LPs.
 */
export interface TakeProfitTier {
  /** BTC price (USD) at which this tier arms. */
  btcPriceUsd: number;
  /** Fraction of the B2 pouch sold when the tier fires, in bps (0–10000). */
  sellBps: number;
}

/**
 * Curtailment configuration (methodology §5.3, `setCurtailmentThresholds` /
 * `setHalvingMonth`). B1 mining is paused when BTC price falls below the
 * pre/post-halving threshold. Thresholds protect margin; they are figures, not
 * a performance claim.
 */
export interface CurtailmentConfig {
  preHalvingThresholdUsd: number;
  postHalvingThresholdUsd: number;
  /** Month index (1-based) at which the halving lands within the term. */
  halvingMonth: number;
}

/**
 * Everything the projection consumes. All fields are CONFIGURED parameters or
 * OBSERVED inputs — never a promised performance number (methodology §3).
 */
export interface MiningNoteInputs {
  /** Subscribed principal in USDC (6-decimal asset), whole units. */
  principalUsdc: number;

  /** Spot BTC price (USD) at inception. */
  btcPriceUsd: number;

  /** Deployed hashrate purchased via revenue-share, TH/s (methodology §4). */
  deployedHashrateTh: number;

  /** Bitcoin hashprice, $/TH/day (derive via hashprice-formula upstream). */
  hashpriceUsdThDay: number;

  /** Fleet uptime fraction (0–1). */
  uptimePct: number;

  /**
   * Monthly electricity bill in USDC, settled from B3 (methodology §4, §5.2).
   * Defaults to the factsheet constant when omitted.
   */
  monthlyElectricityCostUsdc?: number;

  /** Configured take-profit tiers (methodology §5.1). */
  takeProfitTiers: readonly TakeProfitTier[];

  /** Curtailment thresholds + halving month (methodology §5.3). */
  curtailment: CurtailmentConfig;

  /**
   * Assumed monthly BTC price drift, as a fraction (e.g. 0.015 = +1.5%/mo).
   * A single deterministic path drift — the low/high band is produced by the
   * bull/bear multipliers below, NOT by randomness.
   */
  monthlyBtcDriftPct: number;

  /**
   * Band multipliers on the accumulation outcome. `low` is the bear-side
   * assumption set, `high` the bull-side — the two bracket the estimate and are
   * disclosed as assumptions. Both must be > 0 and low ≤ 1 ≤ high.
   */
  bandMultipliers: { low: number; high: number };
}

/** Options controlling the run. Purity: seed injected, no clock, no randomness. */
export interface MiningNoteRunOptions {
  /** Term length in months. Defaults to the factsheet 24. */
  months?: number;
  /**
   * PRNG seed. Kept for parity with the MC companion and reserved for any future
   * seeded jitter; the deterministic path itself does not consume randomness, so
   * the same (inputs, options) always yields the same output regardless of seed.
   */
  seed?: number;
}

// ── Outputs ─────────────────────────────────────────────────────────────────

/** One month of the deterministic projection. All BTC figures are cumulative-safe. */
export interface MiningNoteMonth {
  /** 1-based month index within the term. */
  month: number;

  /** Modelled BTC price (USD) for the month. */
  btcPriceUsd: number;

  /** Whether B1 mining ran this month (false ⇒ curtailed). */
  fleetActive: boolean;

  /** Whether curtailment was in effect this month (methodology §5.3). */
  curtailed: boolean;

  /** Gross mining revenue this month, USD (hashprice × hashrate × uptime × days). */
  miningRevenueUsd: number;

  /** Electricity paid from B3 this month, USDC. */
  electricityPaidUsdc: number;

  /** B3 reserve balance at month end, USDC. */
  reserveUsdc: number;

  /** Vending-curve ratio for the month (1 − month/term), fraction 0–1. */
  vendingRatio: number;

  /** BTC bought into the B2 pouch this month (mining margin + reserve DCA), BTC. */
  btcBoughtThisMonth: number;

  /** BTC sold to USDC by take-profit this month, BTC. */
  btcSoldThisMonth: number;

  /** Cumulative BTC accumulated through this month, BTC. */
  btcAccumulated: number;
}

/** Accumulated-BTC range — the headline. Never a single point (non-negotiable #1). */
export interface BtcAccumulatedRange {
  /** Bear-side accumulated BTC at maturity. */
  low: number;
  /** Bull-side accumulated BTC at maturity. */
  high: number;
}

export interface MiningNoteProjection {
  /** Headline: accumulated-BTC RANGE at maturity, expressed in BTC. */
  btcAccumulatedRange: BtcAccumulatedRange;

  /** The deterministic base-path monthly ledger (band = 1.0). */
  monthly: readonly MiningNoteMonth[];

  /** Every assumption fed into the projection (methodology §6, non-negotiable #10). */
  assumptions: readonly string[];

  /** Verbatim "not guaranteed" disclaimer (methodology §10). */
  disclaimer: string;

  /** Always `estimated` — the return range is derived/modelled (methodology §3, §7). */
  provenance: Provenance;
}
