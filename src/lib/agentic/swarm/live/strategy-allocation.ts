/**
 * strategy-allocation.ts — pure regime-allocation bridge.
 *
 * Derives the 4-sleeve allocation (mining / btc_tactical / usdc_base /
 * stable_reserve) from the LIVE inputs via the real allocator, then enforces
 * the BTC Mining Performance Vault's 30% mining floor.
 *
 * PURE: no I/O, no Date.now(), no Math.random(), no server imports.
 * Only depends on the allocator (pure), the rebalancing-rules constants
 * (pure), the product constants (pure), and the product guards (pure).
 */

import { allocate } from "@/lib/telegram/allocator";
import {
  BASE_MIX_BY_MODE,
  type AllocationMix,
} from "@/lib/engine/rebalancing-rules";
import type { VaultMode } from "@/lib/engine/types";
import {
  BTC_MINING_PERFORMANCE_VAULT,
  type BtcScenarioBand,
} from "@/lib/products/btc-mining-performance-vault";
import {
  clampToFloorOrFlag,
  MINING_FLOOR,
  type MiningFloorMode,
} from "@/lib/products/guards";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RegimeAllocationArgs {
  /**
   * Vault mode for which to derive the allocation.
   * "defensive" → bear BTC tilt, "opportunistic" → bull BTC tilt,
   * "balanced" → base BTC tilt.
   */
  regime: VaultMode;
  /** Net mining yield from the strategy artifact (%). May be negative. */
  miningYieldPct: number;
  /** Best live USDC / DeFi yield (%). */
  usdcYieldPct: number;
  /**
   * If provided, overrides the regime's canonical BTC scenario tilt.
   * Otherwise derived from the product's btcScenarios.
   */
  btcExpectedReturnPctOverride?: number;
  /**
   * Governance mode controlling the floor enforcement. Callers that are NOT
   * under explicit protection/recovery governance must always pass 'NORMAL'
   * (the default), which prevents silent sub-floor allocation.
   */
  floorMode?: MiningFloorMode;
}

export interface RegimeAllocationResult {
  regime: VaultMode;
  /** 4-sleeve allocation (percent, sums to 100). */
  mining: number;
  btc: number;
  usdc: number;
  stableReserve: number;
  /**
   * The raw mining fraction (0..1) BEFORE the 4th-sleeve split so callers
   * can feed it directly into the MC engine's miningWeight.
   */
  miningFraction: number;
  /** True if mining was clamped up to the 30% floor or flagged for governance. */
  governanceException: boolean;
  /**
   * True when mining yield is strictly positive at current market conditions
   * (proxy: miningYieldPct > 0). When false the allocator naturally reduces
   * the mining weight toward the floor.
   */
  miningProfitable: boolean;
  /** Short human-readable rationale (pure text, no invented numbers). */
  rationale: string;
  /**
   * BTC expected-return % used for this regime (taken from the product's
   * canonical BtcScenarioBand or the caller's override).
   */
  btcExpectedReturnPct: number;
  /**
   * Allocator diagnostic scores before normalization (for transparency).
   */
  allocatorScores: { mining: number; btc: number; usdc: number };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Pick the regime's canonical BTC scenario tilt from the product constant. */
function btcScenarioForRegime(
  regime: VaultMode,
  scenarios: BtcScenarioBand,
): number {
  // defensive → bear; balanced → base; opportunistic → bull.
  // The product stores fractions (e.g. -0.2 = −20%).  Convert to percent.
  switch (regime) {
    case "defensive":
      return scenarios.bear * 100;
    case "opportunistic":
      return scenarios.bull * 100;
    case "balanced":
    default:
      return scenarios.base * 100;
  }
}

/**
 * Split the 3-bucket allocator output (mining / btc / usdc) into the
 * 4-sleeve vault structure (mining / btc_tactical / usdc_base / stable_reserve).
 *
 * The allocator's "usdc" bucket maps to the sum of usdc_base + stable_reserve.
 * We preserve the BASE_MIX ratio between those two sub-buckets for the regime,
 * so the split is consistent with the regime's rebalancing-rule defaults.
 *
 *   stable_reserve = usdc_total × (stable_reserve_base / (usdc_base_base + stable_reserve_base))
 *   usdc_base      = usdc_total − stable_reserve
 */
function splitUsdcSleeve(
  usdcTotalPct: number,
  base: AllocationMix,
): { usdc: number; stableReserve: number } {
  const totalStable = base.usdc_base + base.stable_reserve;
  if (totalStable <= 0) {
    return { usdc: usdcTotalPct, stableReserve: 0 };
  }
  const stableReservePct = usdcTotalPct * (base.stable_reserve / totalStable);
  const usdcPct = usdcTotalPct - stableReservePct;
  return {
    usdc: round2(usdcPct),
    stableReserve: round2(stableReservePct),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Derive the 4-sleeve allocation for a given vault-mode regime from the LIVE
 * strategy inputs. Steps:
 *
 *   1. Determine the regime's BTC expected-return tilt from the product constant.
 *   2. Feed live yields + per-regime bounds into the allocator.
 *   3. Enforce the 30% mining floor via clampToFloorOrFlag (NORMAL unless
 *      the caller explicitly passes a governance mode).
 *   4. Re-normalise the 4-sleeve sum to 100%.
 *   5. Split the allocator's USDC bucket into usdc_base + stable_reserve per
 *      the regime's BASE_MIX ratio.
 */
export function deriveRegimeAllocation(
  args: RegimeAllocationArgs,
): RegimeAllocationResult {
  const {
    regime,
    miningYieldPct,
    usdcYieldPct,
    btcExpectedReturnPctOverride,
    floorMode = "NORMAL",
  } = args;

  const miningProfitable = miningYieldPct > 0;
  const base = BASE_MIX_BY_MODE[regime];
  const btcScenarios = BTC_MINING_PERFORMANCE_VAULT.levers.btcScenarios.value;

  const btcExpectedReturnPct =
    btcExpectedReturnPctOverride !== undefined
      ? btcExpectedReturnPctOverride
      : btcScenarioForRegime(regime, btcScenarios);

  // Per-regime bounds from BASE_MIX + product floor.
  // The allocator works in percent (0–100).  The mining floor is 30% minimum.
  const miningFloorPct = MINING_FLOOR * 100; // 30
  const miningMaxPct = Math.min(45, base.mining + 10); // cap from product (max 40 + grace)

  // btc_tactical bounds from the regime's base mix (±10pp grace).
  const btcMin = Math.max(0, base.btc_tactical - 10);
  const btcMax = Math.min(55, base.btc_tactical + 15);

  // USDC = usdc_base + stable_reserve combined (allocator treats as 1 bucket).
  const usdcBaseTotal = base.usdc_base + base.stable_reserve;
  const usdcMin = Math.max(5, usdcBaseTotal - 20);
  const usdcMax = Math.min(85, usdcBaseTotal + 30);

  const raw3 = allocate({
    miningYieldPct,
    btcExpectedReturnPct,
    usdcYieldPct,
    bounds: {
      mining: [miningFloorPct, miningMaxPct],
      btc: [btcMin, btcMax],
      usdc: [usdcMin, usdcMax],
    },
  });

  // Detect whether the allocator *wanted* to go below the floor due to
  // unprofitable mining. The Sharpe score for mining is 0 whenever miningYieldPct
  // <= 0 (max(0, return) = 0), meaning the unconstrained allocator would park
  // nothing in mining. The bounds then force it to the floor — that is a
  // governance exception: the product requires 30% minimum even when the engine
  // says 0%.
  //
  // When miningYieldPct > 0, the allocator may still allocate less than 30% to
  // mining if other buckets (USDC, BTC) dominate by risk-adjusted score. That is
  // also a floor breach, but it's a routine regime adjustment (the product's
  // 30% floor is enforced by the bounds), NOT a governance exception requiring a
  // flag. The governance exception flag is reserved for the economically meaningful
  // case: mining is loss-making but the product forces exposure anyway.
  const miningScoreIsZero = raw3.scores.mining === 0; // true when miningYieldPct <= 0

  // The actual allocation is what the allocator returned (bounds enforced 30% min).
  const clampedMiningFraction = Math.max(MINING_FLOOR, raw3.miningPct / 100);

  // Run clampToFloorOrFlag on the *allocator's score-implied raw fraction*:
  // if mining score is zero the unconstrained weight is 0, which is sub-floor.
  const rawFractionForGuard = miningScoreIsZero ? 0 : clampedMiningFraction;
  const clamp = clampToFloorOrFlag(rawFractionForGuard, floorMode);
  const governanceException = clamp.flagged;

  // If the floor clamped up the mining weight, re-apportion the excess from
  // the BTC bucket (the highest-weight free bucket) to keep the sum at 100%.
  const miningPct = round2(clampedMiningFraction * 100);
  const miningDelta = miningPct - raw3.miningPct; // positive if clamped up

  // Absorb the delta from btc if possible, then from usdc.
  let btcPct = raw3.btcPct;
  let usdcTotalPct = raw3.usdcPct;

  if (miningDelta > 0) {
    const fromBtc = Math.min(btcPct - btcMin, miningDelta);
    btcPct = round2(btcPct - fromBtc);
    const remaining = miningDelta - fromBtc;
    if (remaining > 0) {
      usdcTotalPct = round2(Math.max(usdcMin, usdcTotalPct - remaining));
    }
  }

  // Re-normalise to 100 after any rounding drift.
  const total = miningPct + btcPct + usdcTotalPct;
  const slack = round2(100 - total);
  usdcTotalPct = round2(usdcTotalPct + slack);

  // Split USDC bucket into usdc_base + stable_reserve per the regime ratio.
  const { usdc, stableReserve } = splitUsdcSleeve(usdcTotalPct, base);

  // Rationale (pure text, no invented numbers).
  const profitableLabel = miningProfitable
    ? "profitable mining"
    : "underwater mining (rotated toward USDC floor)";
  const floorNote = governanceException
    ? ` Mining clamped to 30% floor (governance exception flagged).`
    : "";
  const rationale =
    `${regime} regime: ${profitableLabel} at ${miningYieldPct.toFixed(1)}% yield, ` +
    `BTC tilt ${btcExpectedReturnPct >= 0 ? "+" : ""}${btcExpectedReturnPct.toFixed(0)}% (${
      regime === "defensive" ? "bear" : regime === "opportunistic" ? "bull" : "base"
    }), USDC ${usdcYieldPct.toFixed(1)}%.${floorNote}`;

  return {
    regime,
    mining: miningPct,
    btc: btcPct,
    usdc,
    stableReserve,
    miningFraction: clampedMiningFraction,
    governanceException,
    miningProfitable,
    rationale,
    btcExpectedReturnPct,
    allocatorScores: raw3.scores,
  };
}
