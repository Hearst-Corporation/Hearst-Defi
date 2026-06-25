/**
 * Deterministic Intent Router v1 — types.
 *
 * The router classifies a raw user message into a typed decision BEFORE the LLM,
 * so simple/critical/repeatable intents (navigation, read-only education,
 * deploy/send/source refusals, confirmation/cancellation) are handled by rules,
 * not by a model. It NEVER executes anything: it only produces a decision the
 * chat layer can act on (navigate, open a canvas, answer read-only, refuse, or
 * fall through to the LLM). All writes stay behind the existing HITL gate.
 *
 * Pure module: no I/O, no Node/React imports, no DB. Safe to import anywhere.
 */

/** What the message wants. */
export type AgenticIntentKind =
  | "navigation"
  | "education"
  | "product_explanation"
  | "yield_explanation"
  | "risk_explanation"
  | "outreach_setup"
  | "outreach_draft"
  | "product_draft"
  | "vault_readiness"
  | "reporting_request"
  | "deploy_request"
  | "send_request"
  | "source_request"
  | "confirmation"
  | "cancellation"
  | "unknown";

/** How dangerous acting on this intent would be. */
export type AgenticRiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** What the chat layer is allowed to do with this intent. */
export type AgenticActionPolicy =
  | "allow_readonly"
  | "allow_navigation"
  | "allow_canvas"
  | "allow_draft_only"
  | "requires_human_gate"
  | "refuse_autonomous"
  | "needs_clarification"
  | "unknown";

export interface AgenticIntentContext {
  /** Nav scope for route resolution (defaults to "lp"). */
  navProfile?: "lp" | "admin";
  /** True when the signed-in user is an admin (unlocks admin nav/canvas). */
  isAdmin?: boolean;
  /**
   * True when a HITL confirmation token is currently pending for this session.
   * A bare "oui"/"go" only means "confirm" when this is true; otherwise it is an
   * ambiguous confirmation with nothing to confirm.
   */
  hasPendingHumanGate?: boolean;
  /** Scenario Lab nav flag (mirrors the existing nav resolver gate). */
  scenarioLabNavEnabled?: boolean;
}

export interface AgenticIntentDecision {
  kind: AgenticIntentKind;
  /** 0..1 — rule-based confidence. Deterministic matches are high (≥0.8). */
  confidence: number;
  actionPolicy: AgenticActionPolicy;
  riskLevel: AgenticRiskLevel;
  /** Whitelisted nav destination key (navigation only). */
  routeKey?: string;
  /** Canvas id to open (allow_canvas only): "create-vault" | "outreach". */
  canvasKey?: string;
  /** Forward-looking crew hint for the future Crews layer (advisory only). */
  targetCrew?: string;
  /** True when the chat must still call the LLM to produce the answer. */
  requiresLLM: boolean;
  /** True when the intent opens an agent canvas workshop. */
  requiresCanvas: boolean;
  /** True when any resulting action must pass the human-in-the-loop gate. */
  requiresHumanGate: boolean;
  /**
   * True for a bare confirmation/cancellation that is only meaningful if a HITL
   * action is already pending (so "oui" never executes out of nowhere).
   */
  requiresExistingPendingAction: boolean;
  /**
   * True when acting autonomously on this intent is FORBIDDEN (deploy, go-live,
   * send, source, sign, governance execution, migration…). The router never
   * emits an `allow_*` policy together with this flag.
   */
  prohibitedAutonomousAction: boolean;
  /** Ids of every rule that matched, in evaluation order (traceability). */
  matchedRuleIds: string[];
  /** The normalized input the rules ran against. */
  normalizedInput: string;
  /** True when a negation flipped a positive intent into cancellation/unknown. */
  negated: boolean;
  /** Short human-readable explanation of the decision. */
  reason: string;
}

/** A single deterministic rule. `re` runs against the NORMALIZED input. */
export interface IntentRule {
  id: string;
  kind: AgenticIntentKind;
  actionPolicy: AgenticActionPolicy;
  riskLevel: AgenticRiskLevel;
  re: RegExp;
  requiresLLM: boolean;
  requiresCanvas: boolean;
  requiresHumanGate: boolean;
  prohibitedAutonomousAction: boolean;
  canvasKey?: string;
  targetCrew?: string;
  reason: string;
}
