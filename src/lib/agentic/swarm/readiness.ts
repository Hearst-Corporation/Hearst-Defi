/**
 * Action readiness evaluation — the gate every would-be action passes through.
 *
 * Pure and deterministic. It REUSES the existing static registry
 * (ACTION_READINESS_ITEMS) and the existing fail-safe classifier
 * (classifyUnknownAction) — it does not duplicate policy data.
 *
 * Tier contract (global floor, no permissive fallback):
 *  - forbidden_autonomous      → always `blocked`, regardless of any token.
 *  - confirmed_write           → `requires_human_confirmation`, unless an explicit
 *                                 human confirmation token is present → `allow`
 *                                 (still never autonomous).
 *  - draft_or_proposal         → `gated` (draft is fine; the effect needs a gate).
 *  - read_only                 → `allow`.
 *  - unknown write-like action → `blocked` (fail-safe via classifyUnknownAction).
 *
 * Swarm boundary (when a swarm scope is supplied — enforcement is
 * most-restrictive-wins; a swarm can only TIGHTEN the tier floor, never loosen it):
 *  1. forbidden_autonomous tier             → blocked / forbidden_autonomous (global floor)
 *  2. action ∈ swarm.forbiddenActions       → blocked / forbidden_by_swarm (even WITH a token)
 *  3. swarm.allowedActionIds set & action ∉ → blocked / action_out_of_swarm_scope
 *  4. otherwise                             → the tier decision above
 * When no swarm is supplied (or it has no allowedActionIds), behaviour is the
 * backward-compatible tier-only evaluation.
 */

import {
  ACTION_READINESS_ITEMS,
  classifyUnknownAction,
} from "../action-readiness";
import type { ActionReadinessTier } from "../action-readiness/types";
import type { SwarmDefinition } from "./types";

/** Minimal swarm shape the readiness gate enforces. */
export type SwarmReadinessScope = Pick<
  SwarmDefinition,
  "mode" | "forbiddenActions"
> & { allowedActionIds?: string[] };

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
  /** True only when a supplied swarm scope changed the decision (tightened it). */
  swarmScoped: boolean;
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
        ? // NOTE: renamed from confirmed_write_token_present — "token present" read
          // as "autonomy granted" while autonomousAllowed stays false. This code
          // means a human confirmation is on file, not that the action self-executes.
          { decision: "allow", reasonCode: "human_confirmation_token_present" }
        : {
            decision: "requires_human_confirmation",
            reasonCode: "confirmed_write_needs_human",
          };
    case "forbidden_autonomous":
      return { decision: "blocked", reasonCode: "forbidden_autonomous" };
    default: {
      // Exhaustiveness guard: any unmodelled tier fails closed. UNREACHABLE today
      // (the tier union is closed) — if this code is ever observed at runtime it
      // signals a deploy/codegen bug, not a normal event. Alarm, don't dashboard.
      const _never: never = tier;
      void _never;
      return { decision: "blocked", reasonCode: "unknown_tier_blocked" };
    }
  }
}

/**
 * Evaluate whether an action is ready, given a context and an optional swarm
 * scope. Never throws; unknown ids are classified fail-safe. `autonomousAllowed`
 * is structurally `false`. A swarm scope can only tighten the result to `blocked`.
 */
export function evaluateActionReadiness(
  actionId: string,
  context: ActionReadinessContext = {},
  swarm?: SwarmReadinessScope,
): ActionReadinessEvaluation {
  const hasToken = context.hasHumanConfirmationToken === true;
  const item = ACTION_READINESS_ITEMS.find((a) => a.id === actionId);

  const tier: ActionReadinessTier = item
    ? item.tier
    : classifyUnknownAction(actionId).tier;
  const unknown = !item;
  const meta = item ?? classifyUnknownAction(actionId);
  const base = tierToDecision(tier, hasToken);

  const build = (
    decision: ActionDecision,
    rawReasonCode: string,
    opts: { swarmScoped?: boolean; raw?: boolean } = {},
  ): ActionReadinessEvaluation => ({
    actionId,
    tier,
    decision,
    autonomousAllowed: false,
    humanGateRequired: meta.humanGateRequired,
    confirmationRequired: meta.confirmationRequired,
    // Tier reason codes carry the unknown_action: prefix for unknown ids; swarm
    // policy codes are emitted raw (they are not tier-derived).
    reasonCode:
      unknown && !opts.raw ? `unknown_action:${rawReasonCode}` : rawReasonCode,
    reason: meta.reason,
    unknown,
    swarmScoped: opts.swarmScoped === true,
  });

  // 1) Global tier floor: forbidden_autonomous is blocked for everyone, always.
  if (tier === "forbidden_autonomous") {
    return build("blocked", "forbidden_autonomous");
  }

  // 2) Swarm boundary (most-restrictive-wins; tighten only).
  if (swarm) {
    if (swarm.forbiddenActions.includes(actionId)) {
      return build("blocked", "forbidden_by_swarm", { swarmScoped: true, raw: true });
    }
    if (
      Array.isArray(swarm.allowedActionIds) &&
      !swarm.allowedActionIds.includes(actionId)
    ) {
      return build("blocked", "action_out_of_swarm_scope", {
        swarmScoped: true,
        raw: true,
      });
    }
  }

  // 3) In-scope (or unscoped) → the tier decision.
  return build(base.decision, base.reasonCode);
}
