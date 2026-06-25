import "server-only";

// Router Observability v1 — admin-only read path (durable + trends, unified).
//
// Builds the RouterObservabilitySummary the Control Center renders: traces within
// a time window (durable DB first, Redis/memory fallback), aggregate stats, top
// matched rules, time-bucketed TRENDS over the SAME durable traces, the backend
// that served the read, and an honest state. Read-only: no mutation, no LLM, no
// tool execution.

import { readTracesWithFallback } from "./store";
import {
  durableReadTraces,
  durableAggregateByDay,
  getRetentionConfig,
  getRouterTraceRetentionDays,
  topMatchedRules,
  windowCutoff,
} from "./db-store";
import { computeRouterDecisionStats } from "./stats";
import {
  buildRouterDecisionTrendBuckets,
  normalizeRouterTrendWindow,
} from "./trends";
import type {
  RouterLongTermSummary,
  RouterObservabilityState,
  RouterObservabilitySummary,
  RouterObservabilityWindow,
} from "./types";

/** Default long-term horizon (days) for the per-day aggregate view. */
export const DEFAULT_LONG_TERM_HORIZON_DAYS = 30;

export const ROUTER_OBSERVABILITY_SAFETY_NOTE =
  "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.";

const ROUTER_OBSERVABILITY_PRIVACY_MODE =
  "metadata-only (ids + enums + flags); user message text never stored";

/** Constant, verbatim retention/privacy policy line for the admin UI. */
const ROUTER_TRACE_RETENTION_POLICY_NOTE =
  "Retention policy: router decision metadata only, default 90 days. No user messages, prompts, secrets, or tool payloads are stored.";

// Aggregate cap: the windowed read fetches up to this many rows (newest-first)
// for stats + trends + top-rules over the whole window. The createdAt index keeps
// this a single bounded query even for 30d.
const AGGREGATE_READ_LIMIT = 5000;
// The recent-decisions TABLE only shows the newest few — sliced in-memory from
// the same windowed read (no second query).
const RECENT_TABLE_LIMIT = 50;
const TOP_RULES_LIMIT = 8;

/** Windows whose horizon exceeds the volatile fallback buffer (7-day TTL). */
const LONG_WINDOWS: ReadonlySet<RouterObservabilityWindow> = new Set(["30d"]);

function isWindow(value: string | undefined): value is RouterObservabilityWindow {
  return value === "1h" || value === "24h" || value === "7d" || value === "30d";
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
 * Redis, then memory. The window drives BOTH the recent-traces view and the trend
 * buckets (computed from the SAME durable traces). State: unavailable / empty /
 * enabled.
 */
/**
 * Build the long-term per-day aggregate over the durable table. Read-only and
 * best-effort: if the durable DB is unavailable it returns an honest
 * `available: false` summary (the window views still work via fallback).
 */
export async function buildLongTermSummary(args?: {
  horizonDays?: number;
  now?: number;
}): Promise<RouterLongTermSummary> {
  const retention = getRetentionConfig();
  const horizonDays = Math.max(
    1,
    Math.min(args?.horizonDays ?? DEFAULT_LONG_TERM_HORIZON_DAYS, retention.retentionDays),
  );
  const { ok, days } = await durableAggregateByDay({
    horizonDays,
    now: args?.now,
  });

  const totals = {
    navigationFastPaths: 0,
    dangerousRefusals: 0,
    educationalTurns: 0,
    negatedNoNav: 0,
    normalOrUnknown: 0,
  };
  let total = 0;
  for (const d of days) {
    total += d.total;
    totals.navigationFastPaths += d.navigationFastPaths;
    totals.dangerousRefusals += d.dangerousRefusals;
    totals.educationalTurns += d.educationalTurns;
    totals.negatedNoNav += d.negatedNoNav;
    totals.normalOrUnknown += d.normalOrUnknown;
  }

  const note = ok
    ? `Durable per-day aggregate over the last ${horizonDays} days (retention ${retention.retentionDays}d${retention.fromEnv ? ", from OBS_RETENTION_DAYS" : ", default"}).`
    : "Long-term aggregate unavailable — the durable store could not be read. Window views fall back to the volatile buffer.";

  return {
    available: ok,
    horizonDays,
    retention,
    days: ok ? days : [],
    total,
    totals,
    note,
  };
}

export async function getRouterObservabilitySummary(args?: {
  window?: RouterObservabilityWindow;
  limit?: number;
  now?: number;
  longTermHorizonDays?: number;
}): Promise<RouterObservabilitySummary> {
  const window = args?.window ?? "24h";
  // The windowed read is bounded by the aggregate cap (stats/trends see the full
  // window); the recent TABLE is sliced from the same result below.
  const limit = args?.limit ?? AGGREGATE_READ_LIMIT;
  const now = args?.now ?? Date.now();
  const cutoffMs = windowCutoff(window, now).getTime();
  const retentionDays = getRouterTraceRetentionDays();

  const { traces, storage } = await readTracesWithFallback({
    window,
    limit,
    cutoffMs,
  });

  // Stats + trends + top-rules over the FULL windowed set; recent table sliced.
  const stats = computeRouterDecisionStats(traces);
  const topRules = topMatchedRules(traces, TOP_RULES_LIMIT);
  const recent = traces.slice(0, RECENT_TABLE_LIMIT);

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
      ? `Durable storage. Rows older than ${retentionDays} days are pruned best-effort; this view shows the selected window.`
      : storage === "redis_fallback"
        ? "Durable storage unavailable — showing the volatile Redis buffer (cap 200, 7-day TTL)."
        : storage === "memory_fallback"
          ? "Durable + Redis storage unavailable — showing the in-memory buffer (lost on restart)."
          : "No trace storage reachable.";

  // Trends — bucketed over the SAME windowed traces + the SAME window.
  const trendWindow = normalizeRouterTrendWindow(window);
  const trendBuckets = buildRouterDecisionTrendBuckets(
    traces,
    trendWindow,
    new Date(now),
  );
  const bufferLimitNote =
    storage === "durable"
      ? `Trends computed from durable router traces (window ${window}; rows pruned > ${retentionDays} days).`
      : "Trends computed from the volatile fallback buffer (durable storage unavailable).";

  // Window-limitation note: a long window (e.g. 30d) cannot be fully served by
  // the volatile fallback (which holds only the capped 7-day recent buffer).
  const windowLimitationNote =
    storage !== "durable" && LONG_WINDOWS.has(window)
      ? "30d is powered by durable router traces when available. The current Redis/memory fallback only contains the capped recent buffer (max 200 traces, 7-day TTL), so this long window may be incomplete."
      : null;

  // Long-term per-day aggregate over the durable table (v1.1). Independent of the
  // selected window; honest `available: false` when the durable store is down.
  const longTerm = await buildLongTermSummary({
    horizonDays: args?.longTermHorizonDays,
    now,
  });

  return {
    state,
    storage,
    window,
    recent,
    stats,
    topMatchedRules: topRules,
    capacity: limit,
    retentionNote,
    safetyNote: ROUTER_OBSERVABILITY_SAFETY_NOTE,
    privacyMode: ROUTER_OBSERVABILITY_PRIVACY_MODE,
    trendWindow,
    trendBuckets,
    bufferLimitNote,
    retentionDays,
    retentionPolicyNote: ROUTER_TRACE_RETENTION_POLICY_NOTE,
    windowLimitationNote,
    longTerm,
  };
}

/** Convenience for diagnostics: did the durable store serve the read? */
export async function isDurableObservabilityAvailable(
  window: RouterObservabilityWindow = "24h",
): Promise<boolean> {
  const res = await durableReadTraces({ window, limit: 1 });
  return res.ok;
}
