/**
 * routing.ts — Anchorage-style quorum routing engine.
 *
 * Decision logic (in priority order):
 *   1. emergencyShutdown  → 5/5 + 0h  + notify board (always strict)
 *   2. allowlisted address → 2/3 + 0h  + no notify   (routine)
 *   3. amount < $100k      → 3/5 + 12h + no notify   (medium)
 *   4. default (sensitive) → 4/5 + 24h + notify board
 *
 * This module is a server-side helper (touches prisma via allowlist.ts).
 * It is NOT a "use server" file itself — wrap calls inside Server Actions
 * (e.g. proposeAction in actions.ts) or Server Components as needed.
 *
 * Integration note for proposeAction() in actions.ts:
 *   import { routeForTransaction } from "@/lib/governance/routing";
 *   const { policy } = await routeForTransaction({
 *     targetAddress: extractedAddress,
 *     actionType,
 *     estimatedAmountUsdc,
 *   });
 *   // Use policy.approveQuorum as requiredSigners and policy.timelockHours
 *   // when writing the GovernanceProposal row.
 *   // Surface policy in the proposal-detail UI for operator transparency.
 */

import "server-only";

import type { AllowlistEntry } from "./allowlist";
import { findAllowlistEntryByAddress } from "./allowlist-queries";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold (in USDC) below which the medium 3/5 routing path applies. */
const SMALL_AMOUNT_THRESHOLD_USDC = 100_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The action types mirror GovernanceProposal.actionType in the DB. */
export type ProposalActionType =
  | "deploy"
  | "pause"
  | "unpause"
  | "updateFees"
  | "updateCaps"
  | "rotateSigners"
  | "sweepFees"
  | "emergencyShutdown";

export interface RoutingPolicy {
  /** Number of approve signatures required to advance to QUEUED. */
  approveQuorum: number;
  /** Number of cancel signatures required to abort from QUEUED / TIMELOCK. */
  cancelQuorum: number;
  /** Hours to wait in TIMELOCK before the proposal becomes EXECUTABLE. */
  timelockHours: number;
  /** Whether the board email notification should be triggered. */
  notifyBoard: boolean;
}

export interface RoutingDecision {
  policy: RoutingPolicy;
  isAllowlisted: boolean;
  allowlistEntry: AllowlistEntry | null;
  /** Human-readable explanation of which rule was applied. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Decision engine (exported for testability via a pure-function overload)
// ---------------------------------------------------------------------------

/**
 * Pure synchronous decision function.
 * Accepts the allowlist lookup result so that tests can inject any scenario
 * without a DB connection.
 *
 * Exported so unit tests can call it directly and bypass the DB layer.
 */
export function computeRoutingDecision(input: {
  actionType: ProposalActionType;
  estimatedAmountUsdc?: number;
  allowlistEntry: AllowlistEntry | null;
}): RoutingDecision {
  const { actionType, estimatedAmountUsdc, allowlistEntry } = input;

  // Rule 1 — emergency shutdown: always maximum strictness
  if (actionType === "emergencyShutdown") {
    return {
      policy: {
        approveQuorum: 5,
        cancelQuorum: 2,
        timelockHours: 0,
        notifyBoard: true,
      },
      isAllowlisted: false,
      allowlistEntry: null,
      reason:
        "emergencyShutdown always requires 5/5 quorum with immediate timelock and board notification, regardless of allowlist.",
    };
  }

  // Rule 2 — known-trusted address on allowlist: fast path
  if (allowlistEntry !== null) {
    return {
      policy: {
        approveQuorum: 2,
        cancelQuorum: 2,
        timelockHours: 0,
        notifyBoard: false,
      },
      isAllowlisted: true,
      allowlistEntry,
      reason: `Target address is allowlisted as "${allowlistEntry.label}" (${allowlistEntry.category}). Routine 2/3-sig fast path applies.`,
    };
  }

  // Rule 3 — small amount (< $100k): medium path
  if (
    estimatedAmountUsdc !== undefined &&
    estimatedAmountUsdc < SMALL_AMOUNT_THRESHOLD_USDC
  ) {
    return {
      policy: {
        approveQuorum: 3,
        cancelQuorum: 2,
        timelockHours: 12,
        notifyBoard: false,
      },
      isAllowlisted: false,
      allowlistEntry: null,
      reason: `Target address is not allowlisted, but estimated amount ($${estimatedAmountUsdc.toLocaleString()}) is below the $100k threshold. Medium 3/5-sig + 12h timelock path applies.`,
    };
  }

  // Rule 4 — default: sensitive path
  return {
    policy: {
      approveQuorum: 4,
      cancelQuorum: 2,
      timelockHours: 24,
      notifyBoard: true,
    },
    isAllowlisted: false,
    allowlistEntry: null,
    reason:
      "Target address is not allowlisted and amount is at or above $100k (or unknown). Sensitive 4/5-sig + 24h timelock + board notification applies.",
  };
}

// ---------------------------------------------------------------------------
// Async entry point (resolves allowlist from DB then delegates to pure fn)
// ---------------------------------------------------------------------------

/**
 * Determines the governance routing policy for a transaction.
 *
 * Call from Server Actions or Server Components only.
 * The DB lookup (findAllowlistEntryByAddress) is the only I/O — the
 * decision logic itself is pure (computeRoutingDecision).
 */
export async function routeForTransaction(input: {
  targetAddress: string;
  actionType: ProposalActionType;
  estimatedAmountUsdc?: number;
}): Promise<RoutingDecision> {
  const { targetAddress, actionType, estimatedAmountUsdc } = input;

  // emergencyShutdown skips the allowlist DB query entirely.
  if (actionType === "emergencyShutdown") {
    return computeRoutingDecision({ actionType, estimatedAmountUsdc, allowlistEntry: null });
  }

  const allowlistEntry = await findAllowlistEntryByAddress(targetAddress);

  return computeRoutingDecision({ actionType, estimatedAmountUsdc, allowlistEntry });
}
