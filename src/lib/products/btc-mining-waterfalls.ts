/**
 * btc-mining-waterfalls.ts — the three product waterfalls (doc §17).
 *
 * Net-new construct. Each waterfall is an ORDERED list of steps describing how
 * cash / value is applied. This module is descriptive + status-aware: it does NOT
 * move money, does NOT promise a distribution, and NEVER implies a guarantee. A
 * step's `status` reflects whether it is currently active / pending / blocked /
 * not-applicable given the funding + exit/recovery state — but the ordering is
 * FIXED and stable (asserted by tests).
 *
 * STRICT pure-function contract (non-negotiable #6): no I/O, no process.env, no
 * Date.now(), no Math.random(), no module-level side effects, no argument mutation.
 *
 * Honesty (non-negotiables #1, #5, #10):
 *   - the monthly distribution step is `blocked` whenever coverage gates it off —
 *     a waterfall NEVER implies a guaranteed distribution;
 *   - recovery steps are `pending`/`not_applicable` unless recovery is active;
 *   - every amount is optional and only set when CALCULATED — never invented.
 */

import type { StableFundingDecision } from "./stable-funding-engine";
import type { ExitRecoveryResult } from "./exit-recovery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaterfallKind = "normal" | "early_closure" | "recovery";

export type WaterfallStepStatus =
  | "active"
  | "pending"
  | "blocked"
  | "not_applicable";

/** Where a step's status/amount came from — never invented. */
export type WaterfallSourceStatus = "CALCULATED" | "CONFIGURED" | "UNKNOWN";

export interface WaterfallStep {
  /** 1-based rank — the FIXED ordering position. */
  readonly rank: number;
  readonly label: string;
  readonly status: WaterfallStepStatus;
  /** Only present when an amount is genuinely CALCULATED. Never fabricated. */
  readonly amount?: number;
  readonly sourceStatus: WaterfallSourceStatus;
  readonly note: string;
}

export interface Waterfall {
  readonly kind: WaterfallKind;
  readonly title: string;
  readonly steps: readonly WaterfallStep[];
}

export interface ProductWaterfalls {
  readonly normal: Waterfall;
  readonly earlyClosure: Waterfall;
  readonly recovery: Waterfall;
}

// ---------------------------------------------------------------------------
// Canonical ordered labels (doc §17). These NEVER reorder — tests assert this.
// ---------------------------------------------------------------------------

const NORMAL_LABELS = [
  "Power / hosting / maintenance",
  "Financing / borrow cost",
  "Stable reserve maintenance",
  "Monthly distribution (coverage ≥ 1.0)",
  "Debt management",
  "Client total target",
  "Operator spread",
  "Machine residual / redeploy",
] as const;

const EARLY_CLOSURE_LABELS = [
  "Realize target performance",
  "Pay accrued distributions",
  "Return principal / settle target",
  "Close client vault",
  "Operator retains / redeploys / sells machines",
] as const;

const RECOVERY_LABELS = [
  "Essential operating costs",
  "Suspend / reduce operator performance fees",
  "Allocate net mining production to client capital recovery",
  "Recover client capital",
  "Optional minimum yield recovery",
  "End recovery at cap / threshold",
  "Residual machines to operator / next vault / sale",
] as const;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface WaterfallInputs {
  /** The funding decision for the period (gates the distribution step). */
  readonly funding?: StableFundingDecision | null;
  /** The exit/recovery state (selects which waterfall is the live one). */
  readonly exitRecovery?: ExitRecoveryResult | null;
}

// ---------------------------------------------------------------------------
// Builders — pure.
// ---------------------------------------------------------------------------

/**
 * Build the normal operating waterfall. Steps are ordered + status-aware:
 *   - the monthly-distribution step is `blocked` when funding gates it off
 *     (coverage < 1.0) and `active` when the funding decision allows it;
 *   - when no funding decision is available, distribution is `pending` with an
 *     UNKNOWN source (we never assume a distribution is payable).
 */
function buildNormal(inputs: WaterfallInputs): Waterfall {
  const funding = inputs.funding ?? null;
  const distributionAllowed = funding?.distributionAllowed ?? null;

  const steps: WaterfallStep[] = NORMAL_LABELS.map((label, i) => {
    const rank = i + 1;
    // Step 4 is the coverage-gated monthly distribution.
    if (rank === 4) {
      if (distributionAllowed === null) {
        return {
          rank,
          label,
          status: "pending",
          sourceStatus: "UNKNOWN",
          note: "Coverage input unavailable — distribution neither confirmed nor implied. Never guaranteed.",
        };
      }
      return distributionAllowed
        ? {
            rank,
            label,
            status: "active",
            sourceStatus: "CALCULATED",
            note: "Coverage ≥ 1.0 — distribution payable from net mining cash flow this period. Targeted, not guaranteed.",
          }
        : {
            rank,
            label,
            status: "blocked",
            sourceStatus: "CALCULATED",
            note: "Coverage below 1.0 — distribution gated off; never paid from principal.",
          };
    }
    // All other normal-operating steps are CONFIGURED order positions.
    return {
      rank,
      label,
      status: "active",
      sourceStatus: "CONFIGURED",
      note: "Operating waterfall position (configured order).",
    };
  });

  return { kind: "normal", title: "Normal operating waterfall", steps };
}

/**
 * Build the early-closure waterfall. It is the LIVE waterfall only when the
 * exit state is EARLY_EXIT_ELIGIBLE; otherwise its steps are `pending`.
 */
function buildEarlyClosure(inputs: WaterfallInputs): Waterfall {
  const live = inputs.exitRecovery?.state === "EARLY_EXIT_ELIGIBLE";
  const steps: WaterfallStep[] = EARLY_CLOSURE_LABELS.map((label, i) => ({
    rank: i + 1,
    label,
    status: live ? "active" : "pending",
    sourceStatus: live ? "CALCULATED" : "CONFIGURED",
    note: live
      ? "Early-closure step engaged — target reached before maturity. A target outcome, not a guarantee."
      : "Early-closure step — applies only if the total performance target is reached before maturity.",
  }));
  return { kind: "early_closure", title: "Early closure waterfall", steps };
}

/**
 * Build the recovery waterfall. It is the LIVE waterfall only when the exit
 * state is RECOVERY_MODE; otherwise its steps are `not_applicable`. The
 * capital-recovery + optional-min-yield steps NEVER imply a guarantee.
 */
function buildRecovery(inputs: WaterfallInputs): Waterfall {
  const live = inputs.exitRecovery?.state === "RECOVERY_MODE";
  const steps: WaterfallStep[] = RECOVERY_LABELS.map((label, i) => {
    const rank = i + 1;
    // Step 5 is explicitly OPTIONAL minimum-yield recovery.
    const optional = rank === 5;
    return {
      rank,
      label,
      status: live ? (optional ? "pending" : "active") : "not_applicable",
      sourceStatus: live ? "CALCULATED" : "CONFIGURED",
      note: live
        ? optional
          ? "Optional minimum-yield recovery — only after capital recovery, only if the waterfall reaches it. Not guaranteed."
          : "Recovery step engaged — net mining production allocated toward client capital recovery. Maximizes probability of recovery; not a promise."
        : "Recovery step — applies only if maturity is reached with capital not fully recovered.",
    };
  });
  return { kind: "recovery", title: "Recovery waterfall", steps };
}

/**
 * Build all three product waterfalls from the funding + exit/recovery context.
 * Pure: same inputs → same waterfalls. Ordering is FIXED; only statuses/notes
 * vary with the context.
 */
export function buildProductWaterfalls(
  inputs: WaterfallInputs = {},
): ProductWaterfalls {
  return {
    normal: buildNormal(inputs),
    earlyClosure: buildEarlyClosure(inputs),
    recovery: buildRecovery(inputs),
  };
}

/**
 * Assert the waterfall step ordering is the canonical one (ranks 1..n, in the
 * fixed label order). Returns violations (empty = ok). Used by tests + the
 * diagnostic so a silent reorder is caught, never shipped.
 */
export function assertWaterfallOrder(wf: Waterfall): string[] {
  const violations: string[] = [];
  const expected =
    wf.kind === "normal"
      ? NORMAL_LABELS
      : wf.kind === "early_closure"
        ? EARLY_CLOSURE_LABELS
        : RECOVERY_LABELS;
  if (wf.steps.length !== expected.length) {
    violations.push(
      `${wf.kind}: ${wf.steps.length} steps, expected ${expected.length}`,
    );
    return violations;
  }
  wf.steps.forEach((step, i) => {
    if (step.rank !== i + 1) {
      violations.push(`${wf.kind}: step ${i} has rank ${step.rank}, expected ${i + 1}`);
    }
    if (step.label !== expected[i]) {
      violations.push(
        `${wf.kind}: step ${i + 1} label "${step.label}" ≠ "${expected[i]}"`,
      );
    }
  });
  return violations;
}
