// Router Observability v0 — barrel export.
//
// Read-only observability of the deterministic intent router. Recording is
// best-effort and never changes router/guard behaviour; reading is admin-only.

export * from "./types";
export {
  buildRouterDecisionTrace,
  buildUnknownDecisionTrace,
} from "./decision-summary";
export {
  computeRouterDecisionStats,
  categorizeOutcome,
} from "./stats";
export {
  normalizeRouterTrendWindow,
  getRouterTrendWindowStart,
  buildRouterDecisionTrendBuckets,
  getTopMatchedRules,
  ROUTER_TREND_BUFFER_NOTE,
} from "./trends";
export { redactSnippet, MAX_SNIPPET_LEN } from "./redact";
export { recordRouterDecisionSafe } from "./record-router-decision";
export {
  getRouterObservabilitySummary,
  buildLongTermSummary,
  resolveWindow,
  isDurableObservabilityAvailable,
  ROUTER_OBSERVABILITY_SAFETY_NOTE,
  DEFAULT_LONG_TERM_HORIZON_DAYS,
} from "./read-router-decisions";
export {
  durableAppendTrace,
  durableReadTraces,
  durableAggregateByDay,
  getRetentionConfig,
  getRouterTraceRetentionDays,
  getRouterTraceRetentionCutoff,
  topMatchedRules,
  pruneOldTraces,
  countTracesOlderThanRetention,
  deleteTracesOlderThanRetention,
  windowCutoff,
  DURABLE_RETENTION_DAYS,
} from "./db-store";
export { pruneRouterDecisionTraces } from "./retention";
export { readDurableRouterDecisionAggregates } from "./db-aggregates";
export { ROUTER_DECISIONS_KEY, ROUTER_DECISIONS_CAP } from "./store";
