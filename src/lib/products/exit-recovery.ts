/**
 * exit-recovery.ts — the pure exit / recovery state machine (doc §13, §14).
 *
 * Net-new construct (doc §1, §6, §21). Drives the cycle through normal maturity,
 * early target exit, protection, and the mandatory 6–12 month recovery extension.
 *
 * STRICT pure-function contract (non-negotiable #6): no I/O, no process.env, no
 * Date.now(), no Math.random(), no module-level side effects, no argument mutation.
 *
 * Rules (doc §13, §14):
 *   - targetReached before maturity → EARLY_EXIT_ELIGIBLE.
 *   - maturityReached && capital recovered → NORMAL_MATURITY.
 *   - maturityReached && capitalNotRecovered → RECOVERY_MODE (default Mode A
 *     'capital_only', 6–12 months; net mining production to client capital
 *     recovery; operator performance fees suspended/reduced until the recovery
 *     waterfall is satisfied).
 *   - coverageStress / collateralStress → PROTECTION_MODE.
 *   - Recovery NEVER promises guaranteed recovery (`guaranteedRecovery: false`).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExitRecoveryState =
  | "ACTIVE"
  | "TARGET_PROGRESS"
  | "EARLY_EXIT_ELIGIBLE"
  | "PHASE_EXIT"
  | "NORMAL_MATURITY"
  | "PROTECTION_MODE"
  | "RECOVERY_MODE"
  | "CLOSED";

/** Recovery mode — Mode A (capital-only) is the MVP default (doc §14). */
export type RecoveryMode = "capital_only" | "capital_plus_min_yield" | "shared_split";

export interface ExitRecoveryTriggers {
  /** Total performance target reached. */
  readonly targetReached: boolean;
  /** The ~24-month maturity has been reached. */
  readonly maturityReached: boolean;
  /** Capital NOT fully recovered at maturity. */
  readonly capitalNotRecovered: boolean;
  /** Coverage under stress (coverage-gated distribution at risk). */
  readonly coverageStress: boolean;
  /** Collateral under stress (LTV/vol). */
  readonly collateralStress: boolean;
  /** Operator/governance has approved the relevant exception/mode. */
  readonly operatorGovernanceApproved: boolean;
}

export interface ExitRecoveryResult {
  readonly state: ExitRecoveryState;
  /** Present only in RECOVERY_MODE. Defaults to Mode A 'capital_only'. */
  readonly recoveryMode?: RecoveryMode;
  /**
   * Recovery NEVER promises full recovery. This flag is always false when set —
   * encoded so no caller can read recovery as a guarantee (doc §14).
   */
  readonly guaranteedRecovery?: false;
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Public API — pure transition
// ---------------------------------------------------------------------------

/**
 * Computes the next exit/recovery state from the current state + triggers. Pure:
 * same (current, triggers) → same result.
 *
 * Priority (doc §13, §14):
 *   1. Maturity + capital not recovered → RECOVERY_MODE (Mode A default).
 *   2. Maturity + capital recovered → NORMAL_MATURITY.
 *   3. Target reached before maturity → EARLY_EXIT_ELIGIBLE.
 *   4. Coverage/collateral stress → PROTECTION_MODE.
 *   5. Otherwise → progress (TARGET_PROGRESS / stay ACTIVE).
 *
 * Note: maturity is evaluated before stress so a matured-but-unrecovered cycle
 * lands in RECOVERY_MODE (its proper backstop), not PROTECTION_MODE.
 */
export function nextExitRecoveryState(
  current: ExitRecoveryState,
  triggers: ExitRecoveryTriggers,
): ExitRecoveryResult {
  // Terminal: once CLOSED, stay CLOSED.
  if (current === "CLOSED") {
    return { state: "CLOSED", note: "Cycle closed; terminal state." };
  }

  // 1. Maturity reached.
  if (triggers.maturityReached) {
    if (triggers.capitalNotRecovered) {
      // RECOVERY_MODE — Mode A capital-only default. Net mining production is
      // allocated to client capital recovery; operator performance fees are
      // suspended/reduced until the recovery waterfall is satisfied. NOT a
      // guarantee of recovery.
      return {
        state: "RECOVERY_MODE",
        recoveryMode: "capital_only",
        guaranteedRecovery: false,
        note:
          "Maturity reached with capital not fully recovered — 6–12 month recovery extension (Mode A, capital-only). " +
          "Net mining production is allocated to client capital recovery; operator performance fees suspended/reduced until the recovery waterfall is satisfied. " +
          "Recovery maximizes the probability of full capital return — it is not a promise of recovery.",
      };
    }
    // Maturity + capital recovered → normal maturity.
    return {
      state: "NORMAL_MATURITY",
      note:
        "Maturity reached with capital recovered — normal maturity exit per the waterfall; the mining fleet is not liquidated reflexively.",
    };
  }

  // 2. Target reached before maturity → early exit eligible.
  if (triggers.targetReached) {
    return {
      state: "EARLY_EXIT_ELIGIBLE",
      note:
        "Total performance target reached before maturity — early closure eligible: distributions confirmed, remaining target settled, principal returned per the waterfall. A target outcome, not a guarantee.",
    };
  }

  // 3. Coverage / collateral stress before maturity → protection mode.
  if (triggers.coverageStress || triggers.collateralStress) {
    return {
      state: "PROTECTION_MODE",
      note:
        "Adverse conditions — protection posture: pause expansion, reduce/suspend the coverage-gated distribution, unwind yield overlay first, repay debt, sell BTC only if de-lever + reserve are insufficient. Collateral-protected, not guaranteed.",
    };
  }

  // 4. Otherwise — progress toward target (or stay active).
  if (current === "ACTIVE") {
    return {
      state: "TARGET_PROGRESS",
      note: "Cycle active and progressing toward the total performance target.",
    };
  }

  return {
    state: current,
    note: "No transition trigger — state unchanged.",
  };
}
