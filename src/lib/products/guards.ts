/**
 * guards.ts — pure guards encoding the product's hard rules.
 *
 * Two families of rule, both pure:
 *   1. Target honesty (doc §12): the 8–12% monthly distribution target is
 *      INCLUSIVE in the 20–24% total performance target. The UI must never imply
 *      `8–12% + 20–24% final`. These guards prove inclusion and refuse to ever
 *      emit a summed string.
 *   2. Mining floor (doc §7, §8, §18): mining is never below the 30% structural
 *      floor unless EXPLICITLY in protection/recovery governance.
 *
 * STRICT pure-function contract (non-negotiable #6): no I/O, no process.env, no
 * Date.now(), no Math.random(), no module-level side effects, no argument mutation.
 */

import type { BtcMiningPerformanceVault } from "./btc-mining-performance-vault";

// ---------------------------------------------------------------------------
// Target inclusion / double-count guards (doc §12)
// ---------------------------------------------------------------------------

export interface GuardResult {
  readonly ok: boolean;
  readonly message: string;
}

/** The two honest target strings — never summed. */
export interface SafeTargetStrings {
  /** "8–12% annualized monthly distribution target" */
  readonly distribution: string;
  /** "20–24% total target over ~24 months, inclusive of distributions" */
  readonly total: string;
}

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * Proves the monthly distribution target is INCLUDED in (not additive to) the
 * total performance target: the product must carry
 * `totalPerformanceTarget.inclusiveOfDistributions === true`. Returns
 * `{ ok, message }` — `ok:false` means the structure would allow a double-count.
 */
export function validateTargetInclusion(
  product: BtcMiningPerformanceVault,
): GuardResult {
  const inclusive = product.totalPerformanceTarget.inclusiveOfDistributions;
  if (inclusive !== true) {
    return {
      ok: false,
      message:
        "Total performance target must be inclusive of distributions (never additive).",
    };
  }
  // Structural sanity: an inclusive total band must not sit BELOW the distribution
  // band's compounded cash — otherwise "inclusive" would be incoherent. We only
  // assert the bands are non-degenerate ranges here (honesty, not arithmetic claim).
  const d = product.monthlyDistributionTargetAnnualized;
  const t = product.totalPerformanceTarget;
  if (!(d.max > d.min) && !(t.max > t.min)) {
    return {
      ok: false,
      message: "Targets must be ranges, not single points.",
    };
  }
  return {
    ok: true,
    message:
      "Distribution target is inclusive in the total performance target — the two never sum.",
  };
}

/**
 * Backward-named alias used by callers that read as "assert no double count".
 * Same semantics as `validateTargetInclusion`.
 */
export function assertNoDoubleCount(
  product: BtcMiningPerformanceVault,
): GuardResult {
  return validateTargetInclusion(product);
}

/**
 * Yields the two honest target strings. NEVER returns a summed string — the
 * distribution band and the total band are described as separate, aligned layers.
 */
export function formatTargetsSafely(
  product: BtcMiningPerformanceVault,
): SafeTargetStrings {
  const d = product.monthlyDistributionTargetAnnualized;
  const t = product.totalPerformanceTarget;
  const months = product.targetDurationMonths;
  return {
    distribution: `${pct(d.min)}–${pct(d.max)}% annualized monthly distribution target`,
    total: `${pct(t.min)}–${pct(t.max)}% total target over ~${months} months, inclusive of distributions`,
  };
}

/**
 * Detector: flags ANY attempt to ADD the two target layers. Given two numbers
 * (e.g. a distribution % and a total %), returns true when the caller is trying
 * to present their SUM — which is always a double-count and forbidden by doc §12.
 *
 * This is a semantic tripwire: if a surface ever computes `distribution + total`
 * (or any additive combination of the two layers), route it through this so the
 * intent is rejected rather than rendered.
 */
export function wouldDoubleCount(a: number, b: number): boolean {
  // Adding the distribution layer to the total layer is always a double-count:
  // the total is already inclusive of the distribution. Any finite additive
  // combination of the two distinct layers is flagged.
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  // a + b is only meaningful as a "combined headline" if both are non-zero
  // layer figures; that combined headline is exactly what doc §12 forbids.
  return a > 0 && b > 0;
}

// ---------------------------------------------------------------------------
// Mining-floor guards (doc §7, §8, §18)
// ---------------------------------------------------------------------------

/** Structural mining floor — never below this except under governance. */
export const MINING_FLOOR = 0.3;

/**
 * Governance mode under which the floor may legitimately be breached.
 *   - NORMAL: routine allocator output. Sub-floor is NEVER permitted.
 *   - PROTECTION_GOVERNANCE / RECOVERY_GOVERNANCE: an explicit governance
 *     exception that MAY permit a sub-floor mining weight.
 */
export type MiningFloorMode =
  | "NORMAL"
  | "PROTECTION_GOVERNANCE"
  | "RECOVERY_GOVERNANCE";

export interface MiningFloorResult {
  readonly ok: boolean;
  readonly reason:
    | "at_or_above_floor"
    | "sub_floor_permitted_under_governance"
    | "requires_governance_exception";
}

/**
 * Enforces the structural mining floor.
 *
 *   - In NORMAL mode, `miningPct < 0.30` → `{ ok:false, reason:'requires_governance_exception' }`.
 *     The allocator must never silently emit a sub-floor weight.
 *   - In PROTECTION/RECOVERY governance, a sub-floor value is permitted ONLY
 *     because the caller has explicitly declared that mode.
 *
 * Pure; does not mutate input. `miningPct` is a fraction (0.30 = 30%).
 */
export function enforceMiningFloor(
  miningPct: number,
  mode: MiningFloorMode,
): MiningFloorResult {
  if (!Number.isFinite(miningPct)) {
    return { ok: false, reason: "requires_governance_exception" };
  }
  if (miningPct >= MINING_FLOOR) {
    return { ok: true, reason: "at_or_above_floor" };
  }
  // Below the floor.
  if (mode === "PROTECTION_GOVERNANCE" || mode === "RECOVERY_GOVERNANCE") {
    return { ok: true, reason: "sub_floor_permitted_under_governance" };
  }
  // NORMAL mode: sub-floor is never silently allowed.
  return { ok: false, reason: "requires_governance_exception" };
}

export interface ClampResult {
  /** The post-filter mining weight (fraction). Clamped to the floor in NORMAL. */
  readonly miningPct: number;
  /** True when the input was below the floor and a governance flag is required. */
  readonly flagged: boolean;
  readonly mode: MiningFloorMode;
  readonly reason: MiningFloorResult["reason"];
}

/**
 * Post-filter used by the projection/allocator: takes a raw mining weight and
 * either keeps it (≥ floor), clamps it to the floor (NORMAL, raw < floor), or —
 * under explicit governance — passes the sub-floor value through while FLAGGING
 * it. Never silently allows a sub-floor weight in NORMAL mode.
 *
 * Pure; returns a fresh object.
 */
export function clampToFloorOrFlag(
  miningPct: number,
  mode: MiningFloorMode,
): ClampResult {
  const check = enforceMiningFloor(miningPct, mode);
  if (check.ok && check.reason === "at_or_above_floor") {
    return { miningPct, flagged: false, mode, reason: check.reason };
  }
  if (check.reason === "sub_floor_permitted_under_governance") {
    // Governance explicitly permits the sub-floor value — pass it through, but
    // flag it so the surface always shows the exception, never hides it.
    return { miningPct, flagged: true, mode, reason: check.reason };
  }
  // NORMAL + sub-floor (or non-finite): clamp UP to the floor and flag the breach.
  return {
    miningPct: MINING_FLOOR,
    flagged: true,
    mode,
    reason: "requires_governance_exception",
  };
}
