// Router Observability v0 — decision → safe trace summary (pure, no side effects).
//
// Converts an AgenticIntentDecision plus the derived outcome into a SAFE
// RouterDecisionTrace. This is the privacy seam: it copies ONLY the allowlisted
// metadata fields and DELIBERATELY DROPS the two user-text-bearing fields on the
// decision — `normalizedInput` (the normalized user message) and the free-form
// `reason` string. Nothing here performs I/O.

import type {
  AgenticIntentDecision,
  AgenticIntentKind,
} from "@/lib/agentic/intent-router-types";
import type { RouterDecisionOutcome, RouterDecisionTrace } from "./types";

/** Educational kinds — the trace records the sub-kind only for these. */
const EDUCATIONAL_KINDS: ReadonlySet<AgenticIntentKind> = new Set([
  "education",
  "product_explanation",
  "yield_explanation",
  "risk_explanation",
]);

export interface DecisionSummaryContext {
  /** Trace id (derived from the turn id upstream — never a user value). */
  id: string;
  /** ISO timestamp (injected by the caller — keeps this function pure). */
  createdAt: string;
  /** The derived outcome for this turn. */
  outcome: RouterDecisionOutcome;
  chatId?: string;
  messageId?: string;
}

/**
 * Build a SAFE trace from a decision + context.
 *
 * Allowlist-only: every field is an enum, boolean, number, system id, or a
 * derived flag. The user-text fields (`normalizedInput`, `reason`) are NEVER
 * read here — that is the whole point of this module.
 */
export function buildRouterDecisionTrace(
  decision: AgenticIntentDecision,
  ctx: DecisionSummaryContext,
): RouterDecisionTrace {
  const educationalKind = EDUCATIONAL_KINDS.has(decision.kind)
    ? decision.kind
    : undefined;

  return {
    id: ctx.id,
    createdAt: ctx.createdAt,
    ...(ctx.chatId ? { chatId: ctx.chatId } : {}),
    ...(ctx.messageId ? { messageId: ctx.messageId } : {}),
    kind: decision.kind,
    actionPolicy: decision.actionPolicy,
    confidence: decision.confidence,
    negated: decision.negated,
    // Defensive copy — never share the decision's array reference.
    matchedRuleIds: [...decision.matchedRuleIds],
    ...(decision.routeKey ? { routeKey: decision.routeKey } : {}),
    ...(educationalKind ? { educationalKind } : {}),
    prohibitedAutonomousAction: decision.prohibitedAutonomousAction,
    outcome: ctx.outcome,
    usedLegacyFallback: ctx.outcome === "legacy_fallback_nav",
    tookFastPath: ctx.outcome === "nav_fast_path",
    source: "cockpit_chat",
  };
}

/**
 * Build a trace when there is NO deterministic decision (router threw / returned
 * undefined). Records the outcome and ids only — everything else is a safe empty
 * default, so the admin view still shows the turn happened.
 */
export function buildUnknownDecisionTrace(
  ctx: DecisionSummaryContext,
): RouterDecisionTrace {
  return {
    id: ctx.id,
    createdAt: ctx.createdAt,
    ...(ctx.chatId ? { chatId: ctx.chatId } : {}),
    ...(ctx.messageId ? { messageId: ctx.messageId } : {}),
    kind: "unknown",
    actionPolicy: "unknown",
    negated: false,
    matchedRuleIds: [],
    prohibitedAutonomousAction: false,
    outcome: ctx.outcome,
    usedLegacyFallback: false,
    tookFastPath: false,
    source: "cockpit_chat",
  };
}
