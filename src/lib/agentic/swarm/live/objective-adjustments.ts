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

/** A percentage-point tilt applied to the balanced allocation, pre-floor. */
export interface AllocationTilt {
  /** Signed points added to the stable-reserve sleeve. */
  stableReservePp: number;
  /** Signed points added to the BTC-hold sleeve. */
  btcHoldPp: number;
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
  const allocationTilt: AllocationTilt = { stableReservePp: 0, btcHoldPp: 0 };

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

  // 3. Allocation tilt — computed here (conservative pulls toward the stable
  //    reserve, opportunistic toward BTC), returned for a downstream pass that
  //    threads it through the floor-enforced allocator. It is DELIBERATELY NOT
  //    pushed into `adjustments`: the trace only lists changes that are actually
  //    applied to the numbers (horizon + vol), so the UI never shows an
  //    adjustment that didn't move the projection. Honest-by-construction.
  if (profile.riskProfile === "conservative") {
    allocationTilt.stableReservePp = RISK_TILT_PP;
    allocationTilt.btcHoldPp = -RISK_TILT_PP;
  } else if (profile.riskProfile === "opportunistic") {
    allocationTilt.stableReservePp = -RISK_TILT_PP;
    allocationTilt.btcHoldPp = RISK_TILT_PP;
  }

  return { overrides, allocationTilt, adjustments };
}
