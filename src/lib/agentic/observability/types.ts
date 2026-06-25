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
export type RouterObservabilityWindow = "1h" | "24h" | "7d" | "30d";

/** A matched-rule frequency entry (top-rules list). */
export interface RouterMatchedRuleCount {
  ruleId: string;
  count: number;
}

// ---------------------------------------------------------------------------
// SQL aggregates (v1.2) — read-only. The durable read path computes window
// stats + trend buckets + top rules by SQL GROUP BY (Prisma `groupBy`, NOT raw
// SQL) instead of loading up to 5000 rows and aggregating in memory. The shapes
// below are the narrow projections returned by those grouped queries. Pure
// types — no I/O, client-safe.
// ---------------------------------------------------------------------------

/**
 * Which path computed the window aggregate, surfaced read-only in the admin UI:
 *  - "sql"       → durable DB served the aggregate via SQL GROUP BY (O(buckets))
 *  - "in_memory" → durable rows read, but aggregated in memory (legacy path)
 *  - "fallback"  → durable unavailable; aggregated from the Redis/memory buffer
 */
export type RouterObservabilityAggregationMode = "sql" | "in_memory" | "fallback";

/** One `GROUP BY outcome` row over a window (count of traces per outcome). */
export interface RouterOutcomeAggregateRow {
  outcome: string;
  count: number;
}

/** One `GROUP BY kind` row over a window (count of traces per kind). */
export interface RouterKindAggregateRow {
  kind: string;
  count: number;
}

/**
 * One `GROUP BY (bucketStart, outcome)` row. `bucketStart` is the ISO start of
 * the trend bucket the count belongs to; the read path projects these into the
 * prebuilt bucket slots by index so the rendered bars match the in-memory path.
 */
export interface RouterBucketAggregateRow {
  bucketStart: string;
  outcome: string;
  count: number;
}

/** One matched-rule aggregate row (ruleId → count). Alias of the top-rule shape. */
export type RouterMatchedRuleAggregateRow = RouterMatchedRuleCount;

// ---------------------------------------------------------------------------
// Router Quality Review (v0) — read-only INTERPRETATION of the EXISTING
// observability data. No new query, no new field stored, no rule/guard change.
// Turns the window stats (+ top rules + storage mode) into health rates and a
// read-only watchlist so an admin can SEE degraded patterns. Pure types.
// ---------------------------------------------------------------------------

/** One health rate (0..1) over the window, with its numerator/denominator. */
export interface RouterQualityRate {
  /** Stable key, e.g. "unknown" / "dangerous_refusal". */
  key: string;
  /** Human label, e.g. "Unknown rate". */
  label: string;
  /** Count of decisions in this category over the window. */
  count: number;
  /** Total decisions over the window (the rate denominator). */
  total: number;
  /** count / total, or 0 when total is 0. Rounded to 4 dp. */
  rate: number;
}

/** Severity of a watchlist signal — drives the badge tone only. */
export type RouterQualitySeverity = "info" | "watch" | "alert";

/** One read-only watchlist signal: a named pattern worth an admin's attention. */
export interface RouterQualitySignal {
  /** Stable key, e.g. "high_unknown" / "no_recent_data". */
  key:
    | "high_unknown"
    | "high_dangerous_refusal"
    | "high_fallback"
    | "no_recent_data";
  /** Short label rendered on the watchlist row. */
  label: string;
  /** Whether the signal is currently active (threshold crossed). */
  active: boolean;
  severity: RouterQualitySeverity;
  /** One-line, read-only explanation of what the signal means + the evidence. */
  detail: string;
}

/**
 * The read-only Router Quality Review payload: interpreted rates + a watchlist,
 * derived purely from a RouterObservabilitySummary. NEVER an action, NEVER a
 * rule/prompt change — visibility only.
 */
export interface RouterQualityReview {
  /** The window the review interprets (same as the summary window). */
  window: RouterObservabilityWindow;
  /** Total decisions over the window. */
  total: number;
  /** Health rates over the window (unknown / dangerous / educational / nav / fallback). */
  rates: RouterQualityRate[];
  /** Count of negated-no-nav decisions (a raw count, not a rate). */
  negatedNoNav: number;
  /** Top matched rules over the window (echoed from the summary, read-only). */
  topMatchedRules: RouterMatchedRuleCount[];
  /** The read-only watchlist — every known signal, active or not. */
  watchlist: RouterQualitySignal[];
  /** Number of currently-active watchlist signals. */
  activeSignalCount: number;
  /** Honest note: this is interpretation of existing data, no behaviour change. */
  note: string;
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

// ---------------------------------------------------------------------------
// Retention + long-term aggregate (v1.1) — read-only, over the EXISTING durable
// table. No new model, no new migration, no user text. Long-term counts come
// from a SQL groupBy (createdAt-day × outcome), not a full row load.
// ---------------------------------------------------------------------------

/** The durable retention horizon in effect (env-configurable, best-effort prune). */
export interface RouterRetentionConfig {
  /** Days of history retained before best-effort pruning. */
  retentionDays: number;
  /** True when the value came from OBS_RETENTION_DAYS (else the built-in default). */
  fromEnv: boolean;
}

/** One calendar day of outcome counts (UTC), for the long-term view. */
export interface RouterLongTermDay {
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  total: number;
  navigationFastPaths: number;
  dangerousRefusals: number;
  educationalTurns: number;
  negatedNoNav: number;
  normalOrUnknown: number;
}

/** Long-term aggregate over the durable table (beyond the capped recent window). */
export interface RouterLongTermSummary {
  /** True only when the durable DB served the aggregate (else not available). */
  available: boolean;
  /** Days of history requested for the aggregate. */
  horizonDays: number;
  /** The retention config in effect. */
  retention: RouterRetentionConfig;
  /** Per-day outcome counts, oldest first. Empty when unavailable. */
  days: RouterLongTermDay[];
  /** Total decisions across the horizon. */
  total: number;
  /** Outcome totals across the horizon (by named category). */
  totals: {
    navigationFastPaths: number;
    dangerousRefusals: number;
    educationalTurns: number;
    negatedNoNav: number;
    normalOrUnknown: number;
  };
  /** Honest note about the long-term source / availability. */
  note: string;
}

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
  /** Effective retention horizon in days (default 90, env-overridable). */
  retentionDays: number;
  /** Constant retention/privacy policy line rendered verbatim. */
  retentionPolicyNote: string;
  /**
   * Set when the selected window cannot be fully served by the active storage —
   * e.g. a 30d window while on the Redis/memory fallback (which only holds the
   * capped recent buffer). Null when the window is fully covered. */
  windowLimitationNote: string | null;
  /** Long-term per-day aggregate over the durable table (v1.1). Optional so the
   *  summary stays backward-compatible when the durable store is unavailable. */
  longTerm?: RouterLongTermSummary;
  /**
   * How the windowed stats/trends/top-rules were computed (v1.2):
   *  - "sql"       → durable DB SQL GROUP BY (O(buckets), no 5000-row load)
   *  - "in_memory" → durable rows aggregated in memory (SQL aggregate failed)
   *  - "fallback"  → aggregated from the Redis/memory buffer (durable down)
   * Optional so older summaries / fallback callers stay backward-compatible. */
  aggregationMode?: RouterObservabilityAggregationMode;
  /**
   * Read-only Router Quality Review (v0): interpreted health rates + a watchlist
   * derived from this summary. Optional so the summary stays backward-compatible
   * and so callers that don't need the interpretation can omit it. */
  qualityReview?: RouterQualityReview;
}
