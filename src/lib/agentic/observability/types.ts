// Router Observability v0 — shared types.
//
// READ-ONLY observability of the deterministic intent router. A trace is a small
// SAFE metadata record per chat turn (NO user text, NO prompts, NO tool payloads,
// NO secrets). Traces are recorded best-effort and read back, admin-only, in
// /admin/agentic. Recording NEVER changes router/guard behaviour and NEVER blocks
// the chat response.
//
// Pure types — no I/O, no Node imports. Safe to import anywhere (client-safe).

/** What actually happened on a turn, derived at the decision site in the route. */
export type RouterDecisionOutcome =
  | "nav_fast_path" // router high-confidence navigation, published before the LLM
  | "negated_no_nav" // a negation blocked a would-be nav; fell through to the LLM
  | "dangerous_refusal" // deploy/send/source/… refused before LLM/tool/write
  | "educational_llm" // educational read-only steering applied, then LLM
  | "normal_llm" // ordinary turn → LLM
  | "legacy_fallback_nav" // legacy regex nav fallback published (router missed)
  | "unknown"; // no deterministic decision (router unavailable / unclassified)

/** One recorded router decision. ONLY safe metadata — never user content. */
export interface RouterDecisionTrace {
  /** Trace id (derived from the turn id, never a user value). */
  id: string;
  /** ISO timestamp the trace was recorded. */
  createdAt: string;
  /** Existing CockpitChat id, when in scope (cuid — not user text). */
  chatId?: string;
  /** Existing turn/message id, when in scope (not user text). */
  messageId?: string;
  /** Router intent kind (enum, e.g. "navigation", "yield_explanation"). */
  kind: string;
  /** Router action policy (enum, e.g. "allow_navigation", "refuse_autonomous"). */
  actionPolicy: string;
  /** Rule-based confidence (0..1). */
  confidence?: number;
  /** True when a negation flipped a positive intent. */
  negated: boolean;
  /** Ids of matched rules (system values like "deploy.go_live"). */
  matchedRuleIds: string[];
  /** Whitelisted nav destination key (navigation only — system enum). */
  routeKey?: string;
  /** Educational sub-kind when the turn was educational read-only. */
  educationalKind?: string;
  /** True when acting autonomously on the intent is forbidden. */
  prohibitedAutonomousAction: boolean;
  /** The derived outcome for this turn. */
  outcome: RouterDecisionOutcome;
  /** True when the legacy regex nav fallback published the navigation. */
  usedLegacyFallback: boolean;
  /** True when the router navigation fast-path published before the LLM. */
  tookFastPath: boolean;
  /** Always "cockpit_chat" in v0 (the only emitter). */
  source: "cockpit_chat";
}

/** Aggregate counts over a set of recent traces. */
export interface RouterDecisionStats {
  total: number;
  byKind: Record<string, number>;
  byOutcome: Record<string, number>;
  dangerousRefusals: number;
  negatedNoNav: number;
  educationalTurns: number;
  navigationFastPaths: number;
  legacyFallbacks: number;
  unknownTurns: number;
}

/**
 * Storage state surfaced to the admin UI:
 *  - "enabled"     → a store is available AND at least one trace exists
 *  - "empty"       → a store is available but no trace recorded yet
 *  - "unavailable" → no safe store available in this environment
 */
export type RouterObservabilityState = "enabled" | "empty" | "unavailable";

/**
 * Which backend served the read, in preference order:
 *  - "durable"         → the Prisma table (v1, authoritative)
 *  - "redis_fallback"  → DB unavailable; the v0 Redis capped buffer
 *  - "memory_fallback" → DB + Redis unavailable; the process-local buffer
 *  - "unavailable"     → nothing reachable
 */
export type RouterObservabilityStorage =
  | "durable"
  | "redis_fallback"
  | "memory_fallback"
  | "unavailable";

/** Time window for durable stats/queries. */
export type RouterObservabilityWindow = "1h" | "24h" | "7d";

/** A matched-rule frequency entry (top-rules list). */
export interface RouterMatchedRuleCount {
  ruleId: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Trends (v0.1) — purely additive, computed from the SAME recent trace buffer.
// No new storage, no new fields stored. These are derived views only.
// ---------------------------------------------------------------------------

/** Time window the trend view aggregates over (unified with the durable window). */
export type RouterTrendWindow = RouterObservabilityWindow;

/** One time bucket of decision outcomes. */
export interface RouterDecisionTrendBucket {
  /** Short axis label, e.g. "14:05" or "Mon". */
  label: string;
  /** ISO start of the bucket (inclusive). */
  start: string;
  /** ISO end of the bucket (exclusive). */
  end: string;
  total: number;
  navigationFastPaths: number;
  dangerousRefusals: number;
  educationalTurns: number;
  negatedNoNav: number;
  /** normal_llm + unknown + anything not in a named category. */
  normalOrUnknown: number;
}

/** A matched-rule frequency entry. Alias of RouterMatchedRuleCount (same shape). */
export type RouterMatchedRuleStat = RouterMatchedRuleCount;

/** The read-only payload the Control Center renders. */
export interface RouterObservabilitySummary {
  state: RouterObservabilityState;
  storage: RouterObservabilityStorage;
  /** The time window the summary was computed for. */
  window: RouterObservabilityWindow;
  /** Most recent traces in the window, newest first (already capped). */
  recent: RouterDecisionTrace[];
  stats: RouterDecisionStats;
  /** Most frequently matched rule ids in the window, descending. */
  topMatchedRules: RouterMatchedRuleCount[];
  /** Max traces the read returns. */
  capacity: number;
  /** Human-readable retention note. */
  retentionNote: string;
  /** Constant safety note rendered verbatim. */
  safetyNote: string;
  /** Constant privacy mode label. */
  privacyMode: string;
  /** Selected trend window — same as `window` (durable, unified). */
  trendWindow: RouterTrendWindow;
  /** Time buckets over the selected window, computed from the durable traces. */
  trendBuckets: RouterDecisionTrendBucket[];
  /** Honest note about the trend source. */
  bufferLimitNote: string;
}
