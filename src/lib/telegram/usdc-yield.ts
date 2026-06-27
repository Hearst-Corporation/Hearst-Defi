/**
 * usdc-yield.ts — PURE USDC-sleeve yield selection + net-of-fees rebalancing
 * (no I/O, fully testable).
 *
 * Adrien's directive for the stable bucket:
 *   - several venues are wired (Morpho + others, fed by DeFiLlama);
 *   - pick the BEST yield at time T;
 *   - rebalance between protocols ONLY when the extra yield beats the transfer
 *     (gas/bridge) cost — never churn for a gain the fees would eat.
 *
 * This module is the pure decision layer; the live pool list comes from
 * src/lib/data/defillama.ts (DefiLlamaYield[]). It takes a candidate set + the
 * current position + the switch cost and returns a PTAI-style decision.
 */

export interface UsdcPool {
  /** Protocol slug, e.g. "morpho-blue", "aave-v3". */
  project: string;
  chain: string;
  /** Annualized yield, percent. */
  apy: number;
  /** Total value locked, USD — a liquidity/safety floor. */
  tvlUsd: number;
  /** DeFiLlama pool id (stable key for "are we already here?"). */
  pool: string;
}

export interface UsdcSelectionInput {
  /** Candidate pools (already USDC-filtered upstream). */
  pools: readonly UsdcPool[];
  /** Capital deployed in the USDC sleeve, USD. */
  capitalUsd: number;
  /** Pool id we currently sit in (null = not deployed yet). */
  currentPoolId: string | null;
  /** Flat cost to move the position to another venue, USD (gas + bridge). */
  switchCostUsd: number;
  /** Minimum TVL to consider a pool safe enough (default $10M). */
  minTvlUsd?: number;
  /**
   * Horizon over which the switch must pay for itself, in days (default 30).
   * The extra yield is only counted over this window — we don't justify a swap
   * by a year of yield that may not persist.
   */
  paybackDays?: number;
}

export type UsdcAction = "deploy" | "switch" | "hold";

export interface UsdcDecision {
  action: UsdcAction;
  /** The pool we recommend sitting in. */
  target: UsdcPool | null;
  /** Pool we're currently in, if any. */
  current: UsdcPool | null;
  /** APY pickup from the move, percentage points (0 for hold/deploy-from-cash). */
  apyPickupPct: number;
  /** Gross extra yield over the payback window, USD. */
  grossGainUsd: number;
  /** grossGain − switchCost, USD. Positive ⇒ worth it. */
  netGainUsd: number;
  /** Human reason (PTAI-friendly). */
  reason: string;
}

const DAYS_PER_YEAR = 365;

/**
 * Decide the USDC sleeve placement.
 *   - no pools → hold (nothing to do)
 *   - not yet deployed → deploy into the best eligible pool (no switch cost)
 *   - already deployed → switch ONLY if net-of-fees gain over the window > 0
 */
export function decideUsdcPlacement(input: UsdcSelectionInput): UsdcDecision {
  const minTvl = input.minTvlUsd ?? 10_000_000;
  const paybackDays = input.paybackDays ?? 30;

  const eligible = input.pools
    .filter((p) => p.tvlUsd >= minTvl && Number.isFinite(p.apy) && p.apy > 0)
    .slice()
    .sort((a, b) => b.apy - a.apy);

  const current =
    input.pools.find((p) => p.pool === input.currentPoolId) ?? null;

  if (eligible.length === 0) {
    return {
      action: "hold",
      target: current,
      current,
      apyPickupPct: 0,
      grossGainUsd: 0,
      netGainUsd: 0,
      reason: "No eligible USDC pool above the TVL floor.",
    };
  }

  const best = eligible[0]!;

  // Not deployed yet → deploy into best (cost handled at execution, not gated).
  if (!current) {
    return {
      action: "deploy",
      target: best,
      current: null,
      apyPickupPct: 0,
      grossGainUsd: 0,
      netGainUsd: 0,
      reason: `Deploy USDC sleeve into ${best.project} (${best.chain}) at ${best.apy.toFixed(2)}% APY.`,
    };
  }

  // Already in the best pool → hold.
  if (best.pool === current.pool) {
    return {
      action: "hold",
      target: current,
      current,
      apyPickupPct: 0,
      grossGainUsd: 0,
      netGainUsd: 0,
      reason: `Already in the top venue (${current.project}, ${current.apy.toFixed(2)}%).`,
    };
  }

  // Switch candidate → only if net-of-fees gain over the window is positive.
  const apyPickupPct = round2(best.apy - current.apy);
  const grossGainUsd = round2(
    input.capitalUsd * (apyPickupPct / 100) * (paybackDays / DAYS_PER_YEAR),
  );
  const netGainUsd = round2(grossGainUsd - input.switchCostUsd);

  if (netGainUsd > 0) {
    return {
      action: "switch",
      target: best,
      current,
      apyPickupPct,
      grossGainUsd,
      netGainUsd,
      reason: `Switch ${current.project} → ${best.project}: +${apyPickupPct}pp APY, net +$${netGainUsd} over ${paybackDays}d after $${input.switchCostUsd} fees.`,
    };
  }

  return {
    action: "hold",
    target: current,
    current,
    apyPickupPct,
    grossGainUsd,
    netGainUsd,
    reason: `Hold ${current.project}: +${apyPickupPct}pp would yield $${grossGainUsd} over ${paybackDays}d, below the $${input.switchCostUsd} switch cost.`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
