// Router Quality Review v0 — pure, read-only interpretation of observability.
//
// Turns a RouterObservabilitySummary (already computed) into health RATES and a
// read-only WATCHLIST so an admin can SEE degraded router patterns. This module
// is INTERPRETATION ONLY:
//   - it issues NO query (operates on the summary already fetched),
//   - it changes NO router/guard/HITL behaviour,
//   - it produces NO action — every output is a label, a rate, or a flag.
//
// Pure functions, no I/O, client-safe. Categorization mirrors stats.ts so the
// rates never disagree with the stat cards.

import type {
  RouterObservabilitySummary,
  RouterQualityRate,
  RouterQualityReview,
  RouterQualitySignal,
} from "./types";

// ---------------------------------------------------------------------------
// Thresholds — explicit, documented, read-only. Tuned conservatively for v0;
// they drive the WATCHLIST only (never a behaviour change). A signal is a
// prompt for a human to look, not an automated action.
// ---------------------------------------------------------------------------

/** Unknown rate at/above this fraction → the router is missing classifications. */
export const UNKNOWN_RATE_WATCH = 0.2;
/** Dangerous-refusal rate at/above this → unusual refusal volume (attack or over-refusal). */
export const DANGEROUS_REFUSAL_RATE_WATCH = 0.15;
/** Legacy-fallback rate at/above this → the deterministic router is missing nav. */
export const FALLBACK_RATE_WATCH = 0.1;
/**
 * Minimum decisions before rates are trusted. Below this the window is too thin
 * to raise rate-based signals (avoids alerting on 1/2 = 50%).
 */
export const MIN_SAMPLE_FOR_RATES = 20;

/** count / total, 0 when total is 0, rounded to 4 dp. */
function ratio(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 10000) / 10000;
}

function mkRate(
  key: string,
  label: string,
  count: number,
  total: number,
): RouterQualityRate {
  return { key, label, count, total, rate: ratio(count, total) };
}

/** True when the most recent trend buckets are all empty (no recent traffic). */
function hasNoRecentData(summary: RouterObservabilitySummary): boolean {
  if (summary.stats.total === 0) return true;
  const buckets = summary.trendBuckets;
  if (buckets.length === 0) return true;
  // Look at the last few buckets (newest end). If every one is empty, the
  // router isn't being exercised recently even if the window has older data.
  const tail = buckets.slice(-Math.min(3, buckets.length));
  return tail.every((b) => b.total === 0);
}

/**
 * Is the active read served by a DEGRADED source? Durable + SQL/in-memory is the
 * healthy path; a Redis/memory fallback (or aggregationMode "fallback") means the
 * durable store was unreachable, so the view is partial.
 */
function isDegradedSource(summary: RouterObservabilitySummary): boolean {
  if (summary.storage !== "durable") return true;
  if (summary.aggregationMode === "fallback") return true;
  return false;
}

/**
 * Compute the read-only Quality Review for a summary. Pure: same input → same
 * output, no I/O. Rates are always returned; watchlist signals only go `active`
 * when their threshold is crossed AND the sample is large enough (rate signals)
 * or the structural condition holds (degraded source / no recent data).
 */
export function computeRouterQualityReview(
  summary: RouterObservabilitySummary,
): RouterQualityReview {
  const { stats } = summary;
  const total = stats.total;
  const legacyFallbacks = stats.legacyFallbacks;

  const rates: RouterQualityRate[] = [
    mkRate("unknown", "Unknown rate", stats.unknownTurns, total),
    mkRate("dangerous_refusal", "Dangerous-refusal rate", stats.dangerousRefusals, total),
    mkRate("educational", "Educational rate", stats.educationalTurns, total),
    mkRate("nav_fast_path", "Navigation fast-path rate", stats.navigationFastPaths, total),
    mkRate("legacy_fallback", "Legacy-fallback rate", legacyFallbacks, total),
  ];

  const rateByKey = new Map(rates.map((r) => [r.key, r]));
  const enoughSample = total >= MIN_SAMPLE_FOR_RATES;
  const unknownRate = rateByKey.get("unknown")!.rate;
  const dangerousRate = rateByKey.get("dangerous_refusal")!.rate;
  const fallbackRate = rateByKey.get("legacy_fallback")!.rate;
  const degraded = isDegradedSource(summary);
  const noRecent = hasNoRecentData(summary);

  const watchlist: RouterQualitySignal[] = [
    {
      key: "high_unknown",
      label: "High unknown rate",
      active: enoughSample && unknownRate >= UNKNOWN_RATE_WATCH,
      severity: "watch",
      detail: `Unknown ${(unknownRate * 100).toFixed(1)}% of ${total} decisions (watch ≥ ${(UNKNOWN_RATE_WATCH * 100).toFixed(0)}%, min sample ${MIN_SAMPLE_FOR_RATES}). High unknown means the deterministic router is missing classifications — review, don't auto-change rules.`,
    },
    {
      key: "high_dangerous_refusal",
      label: "High dangerous-refusal rate",
      active: enoughSample && dangerousRate >= DANGEROUS_REFUSAL_RATE_WATCH,
      severity: "alert",
      detail: `Dangerous refusals ${(dangerousRate * 100).toFixed(1)}% of ${total} (watch ≥ ${(DANGEROUS_REFUSAL_RATE_WATCH * 100).toFixed(0)}%). Either elevated refused traffic (deploy/send/source intents) or over-refusal — inspect the recent table; the guard is unchanged.`,
    },
    {
      key: "high_fallback",
      label: "High fallback / degraded source",
      active: degraded || (enoughSample && fallbackRate >= FALLBACK_RATE_WATCH),
      severity: "watch",
      detail: degraded
        ? `The window is served by a degraded source (storage: ${summary.storage}${summary.aggregationMode ? `, aggregation: ${summary.aggregationMode}` : ""}). Numbers may be partial until the durable store is reachable.`
        : `Legacy nav fallback ${(fallbackRate * 100).toFixed(1)}% of ${total} (watch ≥ ${(FALLBACK_RATE_WATCH * 100).toFixed(0)}%). The deterministic router is missing navigation it should resolve.`,
    },
    {
      key: "no_recent_data",
      label: "No recent data",
      active: noRecent,
      severity: "info",
      detail:
        total === 0
          ? "No router decisions in this window. Send chat traffic (or widen the window) to populate the review."
          : "No decisions in the most recent buckets — the router may not be exercised right now, or the pipeline is idle.",
    },
  ];

  const activeSignalCount = watchlist.filter((s) => s.active).length;

  return {
    window: summary.window,
    total,
    rates,
    negatedNoNav: stats.negatedNoNav,
    topMatchedRules: summary.topMatchedRules,
    watchlist,
    activeSignalCount,
    note: "Read-only interpretation of existing router observability. No rule, prompt, guard, or HITL change; no action — visibility only.",
  };
}
