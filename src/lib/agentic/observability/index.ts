// Router Observability v0 — barrel export.
//
// Read-only observability of the deterministic intent router. Recording is
// best-effort and never changes router/guard behaviour; reading is admin-only.

export * from "./types";
export {
  buildRouterDecisionTrace,
  buildUnknownDecisionTrace,
} from "./decision-summary";
export { computeRouterDecisionStats } from "./stats";
export { redactSnippet, MAX_SNIPPET_LEN } from "./redact";
export { recordRouterDecisionSafe } from "./record-router-decision";
export {
  getRouterObservabilitySummary,
  ROUTER_OBSERVABILITY_SAFETY_NOTE,
} from "./read-router-decisions";
export {
  ROUTER_DECISIONS_KEY,
  ROUTER_DECISIONS_CAP,
  getObservabilityStorage,
} from "./store";
