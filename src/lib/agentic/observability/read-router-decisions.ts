import "server-only";

// Router Observability v1 — admin-only read path.
//
// Builds the RouterObservabilitySummary the Control Center renders: traces within
// a time window (durable DB first, Redis/memory fallback), aggregate stats, top
// matched rules, the backend that served the read, and an honest state. Read-only:
// no mutation, no LLM, no tool execution.

import { readTracesWithFallback } from "./store";
import {
  durableReadTraces,
  topMatchedRules,
  windowCutoff,
  DURABLE_RETENTION_DAYS,
} from "./db-store";
import { computeRouterDecisionStats } from "./stats";
import type {
  RouterObservabilityState,
  RouterObservabilitySummary,
  RouterObservabilityWindow,
} from "./types";

export const ROUTER_OBSERVABILITY_SAFETY_NOTE =
  "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.";

const ROUTER_OBSERVABILITY_PRIVACY_MODE =
  "metadata-only (ids + enums + flags); user message text never stored";

const DEFAULT_READ_LIMIT = 200;
const TOP_RULES_LIMIT = 8;

function isWindow(value: string | undefined): value is RouterObservabilityWindow {
  return value === "1h" || value === "24h" || value === "7d";
}

/** Coerce an arbitrary query value to a valid window (default 24h). */
export function resolveWindow(
  value: string | undefined,
): RouterObservabilityWindow {
  return isWindow(value) ? value : "24h";
}

/**
 * Build the read-only observability summary for a window.
 *
 * Storage logic: durable DB is authoritative; on failure the read falls back to
 * Redis, then memory. State:
 *  - storage "unavailable"       → "unavailable"
 *  - store reachable + 0 traces  → "empty"
 *  - store reachable + ≥1 trace  → "enabled"
 */
export async function getRouterObservabilitySummary(args?: {
  window?: RouterObservabilityWindow;
  limit?: number;
  now?: number;
}): Promise<RouterObservabilitySummary> {
  const window = args?.window ?? "24h";
  const limit = args?.limit ?? DEFAULT_READ_LIMIT;
  const now = args?.now ?? Date.now();
  const cutoffMs = windowCutoff(window, now).getTime();

  const { traces, storage } = await readTracesWithFallback({
    window,
    limit,
    cutoffMs,
  });

  const stats = computeRouterDecisionStats(traces);
  const topRules = topMatchedRules(traces, TOP_RULES_LIMIT);

  let state: RouterObservabilityState;
  if (storage === "unavailable") {
    state = "unavailable";
  } else if (traces.length === 0) {
    state = "empty";
  } else {
    state = "enabled";
  }

  const retentionNote =
    storage === "durable"
      ? `Durable storage. Rows older than ${DURABLE_RETENTION_DAYS} days are pruned best-effort; this view shows the selected window.`
      : storage === "redis_fallback"
        ? "Durable storage unavailable — showing the volatile Redis buffer (cap 200, 7-day TTL)."
        : storage === "memory_fallback"
          ? "Durable + Redis storage unavailable — showing the in-memory buffer (lost on restart)."
          : "No trace storage reachable.";

  return {
    state,
    storage,
    window,
    recent: traces,
    stats,
    topMatchedRules: topRules,
    capacity: limit,
    retentionNote,
    safetyNote: ROUTER_OBSERVABILITY_SAFETY_NOTE,
    privacyMode: ROUTER_OBSERVABILITY_PRIVACY_MODE,
  };
}

/** Convenience for diagnostics: did the durable store serve the read? */
export async function isDurableObservabilityAvailable(
  window: RouterObservabilityWindow = "24h",
): Promise<boolean> {
  const res = await durableReadTraces({ window, limit: 1 });
  return res.ok;
}
