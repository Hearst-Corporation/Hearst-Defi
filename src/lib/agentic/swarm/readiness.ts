/**
 * Action readiness evaluation — the gate every would-be action passes through.
 *
 * Pure and deterministic. It REUSES the existing static registry
 * (ACTION_READINESS_ITEMS) and the existing fail-safe classifier
 * (classifyUnknownAction) — it does not duplicate policy data.
 *
 * Safety contract (no permissive fallback):
 *  - forbidden_autonomous      → always `blocked`, regardless of any token.
 *  - confirmed_write           → `requires_human_confirmation`, unless an explicit
 *                                 human confirmation token is present → `allow`
 *                                 (still never autonomous).
 *  - draft_or_proposal         → `gated` (draft is fine; the effect needs a gate).
 *  - read_only                 → `allow`.
 *  - unknown write-like action → `blocked` (fail-safe via classifyUnknownAction).
 */

import {
  ACTION_READINESS_ITEMS,
  classifyUnknownAction,
} from "../action-readiness";
import type { ActionReadinessTier } from "../action-readiness/types";

export type ActionDecision =
  | "allow"
  | "gated"
  | "requires_human_confirmation"
  | "blocked";

export type ActionReadinessContext = {
  /** True only when a verified, explicit human confirmation token is supplied. */
  hasHumanConfirmationToken?: boolean;
};

export type ActionReadinessEvaluation = {
  actionId: string;
  tier: ActionReadinessTier;
  decision: ActionDecision;
  autonomousAllowed: false;
  humanGateRequired: boolean;
  confirmationRequired: boolean;
  /** Stable machine reason code (never free user text). */
  reasonCode: string;
  reason: string;
  /** True when the action id was not in the static registry (classified). */
  unknown: boolean;
};

function tierToDecision(
  tier: ActionReadinessTier,
  hasToken: boolean,
): { decision: ActionDecision; reasonCode: string } {
  switch (tier) {
    case "read_only":
      return { decision: "allow", reasonCode: "read_only_allowed" };
    case "draft_or_proposal":
      return { decision: "gated", reasonCode: "draft_requires_gate" };
    case "confirmed_write":
      return hasToken
        ? { decision: "allow", reasonCode: "confirmed_write_token_present" }
        : {
            decision: "requires_human_confirmation",
            reasonCode: "confirmed_write_needs_human",
          };
    case "forbidden_autonomous":
      return { decision: "blocked", reasonCode: "forbidden_autonomous" };
    default: {
      // Exhaustiveness guard: any unmodelled tier fails closed.
      const _never: never = tier;
      void _never;
      return { decision: "blocked", reasonCode: "unknown_tier_blocked" };
    }
  }
}

/**
 * Evaluate whether an action is ready, given a context. Never throws; unknown
 * ids are classified fail-safe. `autonomousAllowed` is structurally `false`.
 */
export function evaluateActionReadiness(
  actionId: string,
  context: ActionReadinessContext = {},
): ActionReadinessEvaluation {
  const hasToken = context.hasHumanConfirmationToken === true;
  const item = ACTION_READINESS_ITEMS.find((a) => a.id === actionId);

  if (item) {
    const { decision, reasonCode } = tierToDecision(item.tier, hasToken);
    return {
      actionId,
      tier: item.tier,
      decision,
      autonomousAllowed: false,
      humanGateRequired: item.humanGateRequired,
      confirmationRequired: item.confirmationRequired,
      reasonCode,
      reason: item.reason,
      unknown: false,
    };
  }

  // Unknown action → fail-safe classification (write-like → forbidden).
  const classified = classifyUnknownAction(actionId);
  const { decision, reasonCode } = tierToDecision(classified.tier, hasToken);
  return {
    actionId,
    tier: classified.tier,
    decision,
    autonomousAllowed: false,
    humanGateRequired: classified.humanGateRequired,
    confirmationRequired: classified.confirmationRequired,
    reasonCode: `unknown_action:${reasonCode}`,
    reason: classified.reason,
    unknown: true,
  };
}
