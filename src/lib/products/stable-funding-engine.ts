/**
 * stable-funding-engine.ts — the pure stable-funding decision function (doc §10).
 *
 * Net-new construct (doc §1, §21). The operation must pay electricity and
 * operating costs every month, but the SOURCE of that cash is a decision, not a
 * default. The core rule (doc §10) is deliberate and auditable: **the stable
 * reserve does NOT automatically pay electricity.** At each settlement point,
 * costs are financed from the cheapest, least-risky source available, subject to
 * collateral and coverage constraints.
 *
 * STRICT pure-function contract (non-negotiable #6): no I/O, no process.env, no
 * Date.now(), no Math.random(), no module-level side effects, no argument mutation.
 *
 * Encoded rules (doc §10):
 *   - LTV ≥ 0.58 OR volatilityIndex > 90 → veto new borrowing (never BORROW).
 *   - collateral comfortable AND borrowApr < opportunity cost of the productive
 *     stable it would replace (stableYieldRate) → BORROW_AGAINST_BTC may be chosen.
 *   - coverageRatio < 1.0 → distributionAllowed = false (do NOT pay).
 *   - coverageRatio < 0.8 → PAUSE_DISTRIBUTION (suspend).
 *   - Never pay distributions from principal.
 *   - BTC sale (SELL_BTC_LAST_RESORT) only as last resort — when reserve + unwind
 *     cannot cover power AND a collateral event demands it. NOT a default. The
 *     stable reserve is NOT always spent first.
 *   - Never pull the stable reserve below its power-runway floor (minRunway).
 */

// ---------------------------------------------------------------------------
// Thresholds (doc §10, §18) — the LTV/vol veto ladder.
// ---------------------------------------------------------------------------

/** LTV at/above which new borrowing is vetoed (pay-from-reserve threshold). */
const LTV_BORROW_VETO = 0.58;
/** Volatility index above which new borrowing is vetoed. */
const VOL_BORROW_VETO = 90;
/** Coverage at/above which a distribution may be paid (adequate band). */
const COVERAGE_PAY_MIN = 1.0;
/** Coverage below which the distribution is suspended (suspended band). */
const COVERAGE_SUSPEND = 0.8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StableFundingSource =
  | "USE_IDLE_STABLE"
  | "USE_STABLE_YIELD"
  | "BORROW_AGAINST_BTC"
  | "UNWIND_STABLE_YIELD"
  | "UNWIND_BTC_YIELD"
  | "SELL_BTC_LAST_RESORT"
  | "PAUSE_DISTRIBUTION"
  | "PROTECT_COLLATERAL";

export interface StableFundingInput {
  /** Power + ops obligation due this period, USD. */
  powerObligation: number;
  /** Idle stable above the power-runway floor (the cheapest, idle-only slice), USD. */
  idleStableAboveRunway: number;
  /** Live best-pool USDC yield (fraction) — the opportunity cost of spending reserve. */
  stableYieldRate: number;
  /** Live borrow APR on USDC against BTC (fraction). */
  borrowApr: number;
  /** Collateral health proxy, 0–1 (higher = more comfortable). */
  collateralRatio: number;
  /** Current LTV (fraction). */
  ltv: number;
  /** Liquidation buffer headroom (fraction) — informational. */
  liquidationBuffer: number;
  /** Volatility index proxy (0–100). */
  volatilityIndex: number;
  /** Distribution coverage ratio = net mining cash ÷ target distribution. */
  coverageRatio: number;
  /** Current stable reserve runway, USD. */
  stableReserveRunway: number;
  /** Minimum stable reserve runway floor, USD — never breached. */
  minRunway: number;
}

export interface StableFundingDecision {
  readonly source: StableFundingSource;
  readonly reason: string;
  /**
   * Whether the monthly distribution may be paid this period. False whenever
   * coverage < 1.0 — distributions are NEVER paid from principal.
   */
  readonly distributionAllowed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Borrowing is vetoed when LTV is too high or volatility too high (doc §10). */
function borrowVetoed(input: StableFundingInput): boolean {
  return input.ltv >= LTV_BORROW_VETO || input.volatilityIndex > VOL_BORROW_VETO;
}

/**
 * Collateral is "comfortable" when LTV is well below the veto AND the collateral
 * ratio is healthy. This is the precondition for opportunistic borrowing.
 */
function collateralComfortable(input: StableFundingInput): boolean {
  return !borrowVetoed(input) && input.collateralRatio >= 1.0;
}

// ---------------------------------------------------------------------------
// Public API — pure decision function
// ---------------------------------------------------------------------------

/**
 * Chooses the funding source for the period's power/ops obligation, and decides
 * whether the distribution may be paid. Pure: same input → same output, no I/O.
 *
 * Ordering of the rules matters and follows doc §10's worked examples:
 *   1. Coverage gate first — sets `distributionAllowed`; coverage < 0.8 suspends.
 *   2. Borrow veto — LTV/vol breach → PROTECT_COLLATERAL (never borrow).
 *   3. Opportunistic borrow — comfortable collateral + cheap borrow vs stable yield.
 *   4. Idle-stable above runway — cheapest idle slice.
 *   5. Spend stable yield (leave principal deployed).
 *   6. Unwind stable yield → unwind BTC yield → SELL_BTC only as last resort.
 */
export function chooseStableFundingSource(
  input: StableFundingInput,
): StableFundingDecision {
  // ── 1. Coverage gate — never pay a distribution from principal. ──────────
  const coverageOk = isNum(input.coverageRatio);
  const distributionAllowed =
    coverageOk && input.coverageRatio >= COVERAGE_PAY_MIN;

  // coverage < 0.8 → suspend the distribution explicitly (doc §10, §11).
  if (coverageOk && input.coverageRatio < COVERAGE_SUSPEND) {
    return {
      source: "PAUSE_DISTRIBUTION",
      reason: `Coverage ${input.coverageRatio.toFixed(2)} below ${COVERAGE_SUSPEND} — distribution suspended, never paid from principal.`,
      distributionAllowed: false,
    };
  }

  // ── 2. Borrow veto — LTV/vol breach protects collateral (doc §10). ───────
  if (borrowVetoed(input)) {
    // We must still fund power without borrowing. If idle stable above runway
    // can cover it, use it; else unwind yield; else (collateral event) last
    // resort. Borrowing is OFF the table here.
    const funded = fundWithoutBorrowing(input, distributionAllowed, true);
    return funded;
  }

  // ── 3. Opportunistic borrow — cheap borrow vs the stable yield it replaces.
  // Borrow when collateral is comfortable AND the borrow APR is strictly below
  // the opportunity cost of the productive stable it would replace (stableYield).
  if (
    collateralComfortable(input) &&
    isNum(input.borrowApr) &&
    isNum(input.stableYieldRate) &&
    input.borrowApr < input.stableYieldRate
  ) {
    return {
      source: "BORROW_AGAINST_BTC",
      reason: `Collateral comfortable (LTV ${input.ltv.toFixed(2)}); borrow ${(input.borrowApr * 100).toFixed(1)}% < stable yield ${(input.stableYieldRate * 100).toFixed(1)}% — borrowing preserves the productive stable.`,
      distributionAllowed,
    };
  }

  // ── 4–6. No borrow chosen — fund from the cheapest non-borrow source. ────
  return fundWithoutBorrowing(input, distributionAllowed, false);
}

/**
 * Funds the power obligation WITHOUT borrowing, in ascending all-in cost:
 *   idle stable above runway → spend stable yield → unwind stable yield →
 *   unwind BTC yield → SELL_BTC (last resort, collateral event only).
 *
 * Never pulls the stable reserve below `minRunway`. The stable reserve is NOT
 * always spent first — idle stable ABOVE the runway is, which is a different,
 * non-runway slice.
 *
 * @param vetoed true when borrowing was vetoed by LTV/vol (drives the
 *   PROTECT_COLLATERAL signal when nothing safe covers the bill).
 */
function fundWithoutBorrowing(
  input: StableFundingInput,
  distributionAllowed: boolean,
  vetoed: boolean,
): StableFundingDecision {
  const idleAvailable =
    isNum(input.idleStableAboveRunway) && input.idleStableAboveRunway > 0
      ? input.idleStableAboveRunway
      : 0;

  // Step 4 — idle stable ABOVE the runway floor covers the bill: cheapest.
  if (idleAvailable >= input.powerObligation) {
    return {
      source: "USE_IDLE_STABLE",
      reason: "Idle stable above the runway floor covers power — cheapest, idle-only slice; reserve floor untouched.",
      distributionAllowed,
    };
  }

  // Step 5 — spend the stable yield while leaving overlay principal deployed.
  // Only when collateral is NOT in a protect posture (vetoed implies stress).
  if (!vetoed && isNum(input.stableYieldRate) && input.stableYieldRate > 0) {
    return {
      source: "USE_STABLE_YIELD",
      reason: "Spend the stable yield, leaving overlay principal deployed.",
      distributionAllowed,
    };
  }

  // Step 6a — unwind the deployed overlay back to cash (stops income, no
  // collateral impact). Used under stress before touching BTC.
  // Step 6b — unwind BTC yield before selling core BTC.
  // We pick UNWIND_STABLE_YIELD first; UNWIND_BTC_YIELD when no stable overlay.
  const hasStableOverlay = isNum(input.stableYieldRate) && input.stableYieldRate > 0;
  if (hasStableOverlay) {
    return {
      source: "UNWIND_STABLE_YIELD",
      reason: "Pull deployed stable overlay back to cash to fund power — stops income, no collateral impact.",
      distributionAllowed,
    };
  }

  // No stable overlay to unwind — try BTC yield before any BTC sale.
  const hasBtcYieldRunway =
    isNum(input.stableReserveRunway) &&
    input.stableReserveRunway - input.powerObligation >= input.minRunway;
  if (hasBtcYieldRunway) {
    return {
      source: "UNWIND_BTC_YIELD",
      reason: "Unwind BTC yield to fund power before any core BTC sale; reserve floor preserved.",
      distributionAllowed,
    };
  }

  // Last resort — SELL_BTC only when reserve + unwind cannot cover power AND a
  // collateral event demands it. If borrowing was vetoed by an LTV/vol breach,
  // that IS the collateral event; selling de-levers. Otherwise we PROTECT
  // collateral and do not reflexively dump the core.
  if (vetoed) {
    return {
      source: "SELL_BTC_LAST_RESORT",
      reason: "Reserve and unwind cannot cover power and a collateral event (LTV/vol breach) demands de-levering — partial BTC sale, last resort only.",
      distributionAllowed,
    };
  }

  return {
    source: "PROTECT_COLLATERAL",
    reason: "Cannot fund power from idle/yield/unwind without breaching the runway floor; protect collateral and defer rather than sell the core by default.",
    distributionAllowed,
  };
}
