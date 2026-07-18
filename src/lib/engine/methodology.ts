/**
 * Methodology v3.0 — Central Source of Truth for Anchors, Factors and Baselines.
 *
 * This module centralises all "magic numbers" defined by the Hearst Connect
 * methodology. Every value here is an anchor used for fallbacks, stress
 * testing, or risk baselining.
 *
 * @see /docs/methodology/v3.0.md
 */

/**
 * Methodology anchors used as fallbacks when the DB is empty (Zero-State).
 * These represent the "target" or "paper phase" state.
 */
export const METHODOLOGY_ANCHORS = {
  /** Target risk score for the Yield Vault (balanced regime). */
  RISK_SCORE: 38,
  /** Target mining margin score (healthy fleet economics). */
  MINING_MARGIN_SCORE: 64,
} as const;

/**
 * Factors used for stress testing and range widening.
 */
export const METHODOLOGY_FACTORS = {
  /**
   * Multiplier applied to the base APY to derive the Bear scenario projection.
   * Matches the "BTC -40%" stress anchor.
   */
  BEAR_STRESS_FACTOR: 0.65,
  /**
   * Widening band (±15%) applied to single-point projections to comply with
   * CLAUDE.md rule #1 (APY always as a range).
   */
  STRESSED_APY_BAND: 0.15,
  /**
   * ± absolute APY points around a single stressed centre when the DB stores
   * only `stressedApy` (no low/high pair yet — see P1-3 migration).
   */
  STRESSED_APY_POINT_HALF_BAND: 0.4,
} as const;

/**
 * Risk baselines for dimensions that are not yet fully automated via oracles.
 */
export const METHODOLOGY_BASELINES = {
  /** Risk score for smart contracts before a formal audit is completed. */
  SMART_CONTRACT_PRE_AUDIT: 80,
  /** Risk score for counterparty exposure (custody/partners) in Phase 1. */
  COUNTERPARTY: 35,
} as const;
