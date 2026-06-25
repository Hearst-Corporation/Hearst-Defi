import "server-only";

// Router Observability v0 — admin-only read path.
//
// Builds the RouterObservabilitySummary the Control Center renders: recent traces
// (newest first), aggregate stats, and an honest state (enabled / empty /
// unavailable). Read-only: no mutation, no LLM, no tool execution.

import {
  getObservabilityStorage,
  readRecentRouterDecisionTraces,
} from "./store";
import { computeRouterDecisionStats } from "./stats";
import {
  buildRouterDecisionTrendBuckets,
  getTopMatchedRules,
  normalizeRouterTrendWindow,
  ROUTER_TREND_BUFFER_NOTE,
} from "./trends";
import type {
  RouterObservabilityState,
  RouterObservabilitySummary,
  RouterTrendWindow,
} from "./types";

export const ROUTER_OBSERVABILITY_SAFETY_NOTE =
  "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.";

const ROUTER_OBSERVABILITY_PRIVACY_MODE =
  "metadata-only (ids + enums + flags); user message text never stored";

const DEFAULT_READ_LIMIT = 100;

/**
 * Build the read-only observability summary.
 *
 * State logic:
 *  - storage "none"  → "unavailable" (no safe store in this environment)
 *  - storage present + 0 traces → "empty"
 *  - storage present + ≥1 trace → "enabled"
 *
 * Note: in v0 a store is ALWAYS present (Redis or the in-memory fallback), so
 * "unavailable" is reserved for a future mode that finds no safe store at all.
 */
export async function getRouterObservabilitySummary(
  limit = DEFAULT_READ_LIMIT,
  trendWindowInput?: string,
): Promise<RouterObservabilitySummary> {
  const storage = getObservabilityStorage();
  const recent =
    storage === "none" ? [] : await readRecentRouterDecisionTraces(limit);
  const stats = computeRouterDecisionStats(recent);

  let state: RouterObservabilityState;
  if (storage === "none") {
    state = "unavailable";
  } else if (recent.length === 0) {
    state = "empty";
  } else {
    state = "enabled";
  }

  // Trends (v0.1) — derived from the SAME recent buffer, no new storage.
  const trendWindow: RouterTrendWindow =
    normalizeRouterTrendWindow(trendWindowInput);
  const trendBuckets = buildRouterDecisionTrendBuckets(recent, trendWindow);
  const topMatchedRules = getTopMatchedRules(recent);

  return {
    state,
    storage,
    recent,
    stats,
    capacity: limit,
    safetyNote: ROUTER_OBSERVABILITY_SAFETY_NOTE,
    privacyMode: ROUTER_OBSERVABILITY_PRIVACY_MODE,
    trendWindow,
    trendBuckets,
    topMatchedRules,
    bufferLimitNote: ROUTER_TREND_BUFFER_NOTE,
  };
}
