// Router Observability v0.1 — trend computation (pure, read-only).
//
// Turns the SAME capped recent-trace buffer into time-bucketed outcome trends
// and a top-matched-rules frequency list. No storage, no I/O, no new fields
// recorded. Pure functions — fully unit-testable, client-safe.
//
// Outcome categorization MUST match stats.ts (computeRouterDecisionStats) so the
// stat cards and the trend bars never disagree.

import type {
  RouterDecisionTrace,
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
  RouterTrendWindow,
} from "./types";

/** Bucket geometry per window: count of buckets and each bucket's span (ms). */
const WINDOW_GEOMETRY: Record<
  RouterTrendWindow,
  { buckets: number; bucketMs: number }
> = {
  "1h": { buckets: 12, bucketMs: 5 * 60 * 1000 }, // 12 × 5 min
  "24h": { buckets: 24, bucketMs: 60 * 60 * 1000 }, // 24 × 1 h
  "7d": { buckets: 7, bucketMs: 24 * 60 * 60 * 1000 }, // 7 × 1 day
  "30d": { buckets: 30, bucketMs: 24 * 60 * 60 * 1000 }, // 30 × 1 day
};

/** Coerce arbitrary input to a valid window; defaults to "24h". */
export function normalizeRouterTrendWindow(input?: string): RouterTrendWindow {
  return input === "1h" || input === "24h" || input === "7d" || input === "30d"
    ? input
    : "24h";
}

/** The inclusive start instant of the whole window. */
export function getRouterTrendWindowStart(
  window: RouterTrendWindow,
  now: Date = new Date(),
): Date {
  const { buckets, bucketMs } = WINDOW_GEOMETRY[window];
  return new Date(now.getTime() - buckets * bucketMs);
}

/** Short axis label for a bucket start, window-aware. */
function bucketLabel(start: Date, window: RouterTrendWindow): string {
  const iso = start.toISOString();
  if (window === "7d" || window === "30d") {
    // "MM-DD" — daily buckets
    return iso.slice(5, 10);
  }
  // "HH:MM"
  return iso.slice(11, 16);
}

/**
 * Categorize a trace the SAME way computeRouterDecisionStats does, returning the
 * trend-bucket counter key to increment.
 */
function categoryKey(
  trace: RouterDecisionTrace,
): keyof Pick<
  RouterDecisionTrendBucket,
  | "navigationFastPaths"
  | "dangerousRefusals"
  | "educationalTurns"
  | "negatedNoNav"
  | "normalOrUnknown"
> {
  switch (trace.outcome) {
    case "nav_fast_path":
      return "navigationFastPaths";
    case "dangerous_refusal":
      return "dangerousRefusals";
    case "educational_llm":
      return "educationalTurns";
    case "negated_no_nav":
      return "negatedNoNav";
    // normal_llm / unknown / legacy_fallback_nav and any future value fall here.
    default:
      return "normalOrUnknown";
  }
}

function emptyBucket(
  start: Date,
  end: Date,
  window: RouterTrendWindow,
): RouterDecisionTrendBucket {
  return {
    label: bucketLabel(start, window),
    start: start.toISOString(),
    end: end.toISOString(),
    total: 0,
    navigationFastPaths: 0,
    dangerousRefusals: 0,
    educationalTurns: 0,
    negatedNoNav: 0,
    normalOrUnknown: 0,
  };
}

/**
 * Build evenly-spaced, oldest-first buckets for the window and tally each trace
 * into the bucket containing its createdAt. Traces outside the window or with an
 * invalid/missing timestamp are ignored cleanly. Never throws.
 */
export function buildRouterDecisionTrendBuckets(
  traces: RouterDecisionTrace[],
  window: RouterTrendWindow,
  now: Date = new Date(),
): RouterDecisionTrendBucket[] {
  const { buckets: bucketCount, bucketMs } = WINDOW_GEOMETRY[window];
  const nowMs = now.getTime();
  const startMs = nowMs - bucketCount * bucketMs;

  const buckets: RouterDecisionTrendBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bStart = new Date(startMs + i * bucketMs);
    const bEnd = new Date(startMs + (i + 1) * bucketMs);
    buckets.push(emptyBucket(bStart, bEnd, window));
  }

  for (const trace of traces) {
    const t = Date.parse(trace.createdAt);
    if (Number.isNaN(t)) continue; // invalid/missing timestamp → ignore
    if (t < startMs || t >= nowMs) continue; // outside the window → ignore
    const idx = Math.floor((t - startMs) / bucketMs);
    if (idx < 0 || idx >= bucketCount) continue; // defensive
    const bucket = buckets[idx];
    if (!bucket) continue;
    bucket.total += 1;
    bucket[categoryKey(trace)] += 1;
  }

  return buckets;
}

/**
 * Bucket geometry for a window — exposed so the SQL-aggregate path can compute
 * the EXACT same slots (start, span, count) the in-memory path uses, and project
 * SQL-grouped counts into them by index. Keeps the two paths byte-identical.
 */
export function getRouterTrendWindowGeometry(window: RouterTrendWindow): {
  bucketCount: number;
  bucketMs: number;
  startMs: number;
  nowMs: number;
} {
  const { buckets: bucketCount, bucketMs } = WINDOW_GEOMETRY[window];
  const nowMs = Date.now();
  return { bucketCount, bucketMs, startMs: nowMs - bucketCount * bucketMs, nowMs };
}

/**
 * Build the empty, oldest-first bucket slots for a window (same labels/start/end
 * as buildRouterDecisionTrendBuckets, with zero counts). The SQL-aggregate path
 * fills these by index so the rendered bars are identical to the in-memory path.
 */
export function buildEmptyTrendBuckets(
  window: RouterTrendWindow,
  now: Date = new Date(),
): RouterDecisionTrendBucket[] {
  return buildRouterDecisionTrendBuckets([], window, now);
}

/** The category key for an outcome (SQL projection reuses the SAME mapping). */
export function trendCategoryKeyForOutcome(
  outcome: string,
): keyof Pick<
  RouterDecisionTrendBucket,
  | "navigationFastPaths"
  | "dangerousRefusals"
  | "educationalTurns"
  | "negatedNoNav"
  | "normalOrUnknown"
> {
  switch (outcome) {
    case "nav_fast_path":
      return "navigationFastPaths";
    case "dangerous_refusal":
      return "dangerousRefusals";
    case "educational_llm":
      return "educationalTurns";
    case "negated_no_nav":
      return "negatedNoNav";
    default:
      return "normalOrUnknown";
  }
}

/**
 * Frequency of matched rule ids across the recent buffer, descending by count
 * then ruleId for stable ordering. Capped to `limit`.
 */
export function getTopMatchedRules(
  traces: RouterDecisionTrace[],
  limit = 8,
): RouterMatchedRuleStat[] {
  const counts = new Map<string, number>();
  for (const trace of traces) {
    for (const ruleId of trace.matchedRuleIds ?? []) {
      if (!ruleId) continue;
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId))
    .slice(0, Math.max(0, limit));
}

/** Honest, constant note about the capped v0 buffer the trends derive from. */
export const ROUTER_TREND_BUFFER_NOTE =
  "Trends are computed from the capped v0 router trace buffer: max 200 traces, TTL 7 days.";
