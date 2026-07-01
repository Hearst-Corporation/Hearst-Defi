/**
 * Objective-driven projection adjustments — turns an ObjectiveIntentProfile into
 * BOUNDED, TRACED overrides. Pure and deterministic.
 *
 * Guardrails (hard):
 *  - Never invents market data (BTC price, hashprice, live yields) — those stay
 *    100% from the live-read stages. This module only nudges *assumptions* and
 *    *allocation tilt* within small, fixed bounds.
 *  - Every change emits an ObjectiveAdjustment {field, from, to, reason} so the
 *    UI can show exactly what the objective changed and why.
 *  - Bounds are conservative: horizon ∈ {12,24,36}, a small vol multiplier, and
 *    allocation tilts of a few points that are re-normalised + still pass the
 *    product mining floor downstream (the pipeline clamps everything again).
 */

import type { ObjectiveIntentProfile } from "./objective-profile";
import type { QuantAssumptionsOverrides } from "./quant-assumptions";

export interface ObjectiveAdjustment {
  field: string;
  from: string;
  to: string;
  reason: string;
}

/**
 * Signed percentage-point INTENT applied to the NON-MINING sleeves (mining is
 * never touched → the floor is inherently respected). The applier re-normalises
 * these three to keep the total at 100 and clamps each to its band + ≥0.
 */
export interface AllocationTilt {
  /** Signed points added to the stable-reserve sleeve. */
  stableReservePp: number;
  /** Signed points added to the BTC-hold sleeve. */
  btcHoldPp: number;
  /** Signed points added to the yield-overlay sleeve. */
  yieldOverlayPp: number;
}

export interface ObjectiveAdjustmentResult {
  overrides: QuantAssumptionsOverrides;
  allocationTilt: AllocationTilt;
  adjustments: ObjectiveAdjustment[];
}

// Fixed, auditable bounds. No value here is derived from live data.
const HORIZON_MONTHS: Record<"12m" | "24m" | "36m", number> = { "12m": 12, "24m": 24, "36m": 36 };
/** Conservative tilt = more stable reserve, less BTC. Opportunistic = opposite. */
const RISK_TILT_PP = 4; // points moved between sleeves
/** Monthly-income intent lifts the yield-overlay sleeve. */
const INCOME_TILT_PP = 3;
/** High-liquidity preference lifts the stable reserve. */
const LIQUIDITY_TILT_PP = 3;
/** Volatility multiplier applied to the base BTC annualVol assumption. */
const VOL_MULT: Record<"conservative" | "balanced" | "opportunistic", number> = {
  conservative: 0.9,
  balanced: 1.0,
  opportunistic: 1.15,
};
const BASE_BTC_ANNUAL_VOL = 0.6; // == DEFAULT_QUANT_ASSUMPTIONS.btc.annualVol

const fmtMonths = (m: number) => `${m}m`;
const fmtVol = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Derive bounded assumption overrides + an allocation tilt from the objective
 * profile, with a full adjustment trace. Returns empty overrides + a zero tilt
 * (and an empty trace) for a generic/balanced/unknown objective — i.e. the
 * default product assumptions are used and NOTHING is silently changed.
 */
export function deriveObjectiveAssumptionOverrides(
  profile: ObjectiveIntentProfile,
): ObjectiveAdjustmentResult {
  const adjustments: ObjectiveAdjustment[] = [];
  const overrides: QuantAssumptionsOverrides = {};
  const allocationTilt: AllocationTilt = {
    stableReservePp: 0,
    btcHoldPp: 0,
    yieldOverlayPp: 0,
  };

  // 1. Horizon — only when the objective names one explicitly.
  if (profile.horizon !== "unknown") {
    const months = HORIZON_MONTHS[profile.horizon];
    overrides.horizonMonths = months;
    adjustments.push({
      field: "assumptions.horizonMonths",
      from: fmtMonths(12), // the configured default
      to: fmtMonths(months),
      reason: `objective names a ${profile.horizon} horizon`,
    });
  }

  // 2. Volatility assumption — a small multiplier on the base BTC vol by risk.
  const volMult = VOL_MULT[profile.riskProfile];
  if (volMult !== 1.0) {
    const nextVol = Math.round(BASE_BTC_ANNUAL_VOL * volMult * 1000) / 1000;
    overrides.btc = { annualVol: nextVol };
    adjustments.push({
      field: "assumptions.btc.annualVol",
      from: fmtVol(BASE_BTC_ANNUAL_VOL),
      to: fmtVol(nextVol),
      reason: `${profile.riskProfile} risk profile (${volMult}× base vol)`,
    });
  }

  // 3. Allocation tilt — the signed INTENT on the non-mining sleeves. Mining is
  //    never touched here (floor stays respected). The actual, floor/cap-clamped
  //    application happens in applyObjectiveAllocationTilt, which is the ONLY
  //    place that emits allocation adjustments into a trace — so the UI only ever
  //    shows allocation changes that were really applied to the numbers.
  if (profile.riskProfile === "conservative") {
    allocationTilt.stableReservePp += RISK_TILT_PP;
    allocationTilt.btcHoldPp -= RISK_TILT_PP;
  } else if (profile.riskProfile === "opportunistic") {
    allocationTilt.stableReservePp -= RISK_TILT_PP;
    allocationTilt.btcHoldPp += RISK_TILT_PP;
  }
  // Monthly-income intent lifts the yield-overlay sleeve, funded from BTC.
  if (profile.incomePreference === "monthly_distribution") {
    allocationTilt.yieldOverlayPp += INCOME_TILT_PP;
    allocationTilt.btcHoldPp -= INCOME_TILT_PP;
  }
  // High-liquidity preference lifts the stable reserve, funded from BTC.
  if (profile.liquidityPreference === "high") {
    allocationTilt.stableReservePp += LIQUIDITY_TILT_PP;
    allocationTilt.btcHoldPp -= LIQUIDITY_TILT_PP;
  }

  return { overrides, allocationTilt, adjustments };
}

// ---------------------------------------------------------------------------
// Allocation tilt application (pure, floor/cap-respecting)
// ---------------------------------------------------------------------------

/** The four non-mining-aware sleeves the tilt operates on, in percent. */
export interface SleeveAllocation {
  mining: number;
  btcHoldingCollateral: number;
  stableReserve: number;
  yieldOverlay: number;
}

/** Per-sleeve [min, max] percent caps (the product's CONFIGURED bands). */
export interface SleeveBands {
  btcHoldingCollateral: readonly [number, number];
  stableReserve: readonly [number, number];
  yieldOverlay: readonly [number, number];
}

export interface AllocationTiltResult {
  allocation: SleeveAllocation;
  adjustments: ObjectiveAdjustment[];
  /** True if any requested move was clipped by a band cap / floor. */
  limited: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampToBand = (v: number, [lo, hi]: readonly [number, number]) =>
  Math.min(hi, Math.max(lo, v));
const fmtPct = (n: number) => `${round1(n)}%`;

/**
 * Apply an objective allocation tilt to a base 4-sleeve allocation. PURE.
 *
 * Mining is NEVER touched → the 30% mining floor is inherently respected. The
 * tilt moves points among the three non-mining sleeves (btcHolding / stable /
 * yield), each clamped to its CONFIGURED band and to ≥ 0, then the three are
 * re-normalised so their sum equals the original non-mining total (i.e. the
 * grand total stays 100). Emits a trace ONLY for sleeves that actually moved,
 * and flags `limited` when a requested move was clipped by a cap/floor.
 */
export function applyObjectiveAllocationTilt(
  base: SleeveAllocation,
  tilt: AllocationTilt,
  bands: SleeveBands,
): AllocationTiltResult {
  const nonMiningTotal =
    base.btcHoldingCollateral + base.stableReserve + base.yieldOverlay;

  // No tilt requested → return base unchanged (no trace).
  if (tilt.stableReservePp === 0 && tilt.btcHoldPp === 0 && tilt.yieldOverlayPp === 0) {
    return { allocation: { ...base }, adjustments: [], limited: false };
  }

  // 1. Apply the raw signed tilt, clamped per-sleeve to band + ≥0.
  const requested = {
    btcHoldingCollateral: base.btcHoldingCollateral + tilt.btcHoldPp,
    stableReserve: base.stableReserve + tilt.stableReservePp,
    yieldOverlay: base.yieldOverlay + tilt.yieldOverlayPp,
  };
  const clamped = {
    btcHoldingCollateral: Math.max(0, clampToBand(requested.btcHoldingCollateral, bands.btcHoldingCollateral)),
    stableReserve: Math.max(0, clampToBand(requested.stableReserve, bands.stableReserve)),
    yieldOverlay: Math.max(0, clampToBand(requested.yieldOverlay, bands.yieldOverlay)),
  };
  const limited =
    Math.abs(requested.btcHoldingCollateral - clamped.btcHoldingCollateral) > 1e-6 ||
    Math.abs(requested.stableReserve - clamped.stableReserve) > 1e-6 ||
    Math.abs(requested.yieldOverlay - clamped.yieldOverlay) > 1e-6;

  // 2. Re-normalise the three legs back onto the original non-mining total so the
  //    grand total (mining + these three) stays exactly 100.
  const clampedTotal = clamped.btcHoldingCollateral + clamped.stableReserve + clamped.yieldOverlay;
  const scale = clampedTotal > 0 ? nonMiningTotal / clampedTotal : 1;
  const next: SleeveAllocation = {
    mining: base.mining,
    btcHoldingCollateral: round1(clamped.btcHoldingCollateral * scale),
    stableReserve: round1(clamped.stableReserve * scale),
    yieldOverlay: round1(clamped.yieldOverlay * scale),
  };
  // Absorb any rounding residue into the largest non-mining sleeve so the sum
  // is exactly 100 (no invented precision, no negative).
  const residue = round1(100 - (next.mining + next.btcHoldingCollateral + next.stableReserve + next.yieldOverlay));
  if (Math.abs(residue) >= 0.1) {
    const largest = (["btcHoldingCollateral", "stableReserve", "yieldOverlay"] as const).reduce(
      (a, b) => (next[b] > next[a] ? b : a),
    );
    next[largest] = round1(next[largest] + residue);
  }

  // 3. Trace — one line per sleeve that actually moved.
  const adjustments: ObjectiveAdjustment[] = [];
  const limitNote = limited ? " (limited by allocation band)" : "";
  const maybe = (
    key: "btcHoldingCollateral" | "stableReserve" | "yieldOverlay",
    field: string,
    reason: string,
  ) => {
    if (Math.abs(next[key] - base[key]) >= 0.1) {
      adjustments.push({ field, from: fmtPct(base[key]), to: fmtPct(next[key]), reason: reason + limitNote });
    }
  };
  maybe("stableReserve", "allocation.stableReserve", "objective risk / liquidity / income intent");
  maybe("btcHoldingCollateral", "allocation.btcHolding", "objective risk / income intent");
  maybe("yieldOverlay", "allocation.yieldOverlay", "monthly-income objective");

  return { allocation: next, adjustments, limited };
}
