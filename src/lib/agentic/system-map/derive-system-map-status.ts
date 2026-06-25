// Agentic System Map v0 — status derivation (pure, read-only).
//
// Derives the live status of map nodes from the existing read-only summaries.
// Pure: reads counts/flags/rates already computed elsewhere — no I/O, no tool
// execution, no write, no mutation.

import type { RouterStatusSummary } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ToolBoundaryV1Summary } from "@/lib/agentic/tool-boundary/types";
import type { ReportingCrewBriefing } from "@/lib/agentic/reporting/types";
import type { AgenticSystemNodeStatus } from "./types";

/** Router node status: alert if not active/non-shadow or shadow flag alive. */
export function deriveRouterStatus(
  router: RouterStatusSummary,
): AgenticSystemNodeStatus {
  if (router.status !== "active" || router.mode !== "non-shadow") return "alert";
  if (router.shadowFlag.alive) return "watch";
  return "healthy";
}

/** Observability node status from the summary state + storage + quality signals. */
export function deriveObservabilityStatus(
  observability: RouterObservabilitySummary | null,
): AgenticSystemNodeStatus {
  if (!observability) return "no_data";
  if (observability.state === "unavailable") return "no_data";
  if (observability.state === "empty") return "no_data";
  // Active dangerous-refusal/quality alert → alert.
  const review = observability.qualityReview;
  if (review?.watchlist.some((w) => w.active && w.severity === "alert")) {
    return "alert";
  }
  // Fallback storage or any active watch signal → watch.
  if (
    observability.storage === "redis_fallback" ||
    observability.storage === "memory_fallback" ||
    observability.aggregationMode === "fallback"
  ) {
    return "watch";
  }
  if (review?.watchlist.some((w) => w.active && w.severity === "watch")) {
    return "watch";
  }
  return "healthy";
}

/** Quality-review node status from active signals only. */
export function deriveQualityStatus(
  observability: RouterObservabilitySummary | null,
): AgenticSystemNodeStatus {
  const review = observability?.qualityReview;
  if (!review) return "no_data";
  if (review.total === 0) return "no_data";
  if (review.watchlist.some((w) => w.active && w.severity === "alert")) return "alert";
  if (review.watchlist.some((w) => w.active && w.severity === "watch")) return "watch";
  return "healthy";
}

/** Tool-boundary node status: alert on unknown tools or critical consistency issues. */
export function deriveToolBoundaryStatus(
  toolBoundary: ToolBoundaryV1Summary | undefined,
): AgenticSystemNodeStatus {
  if (!toolBoundary) return "no_data";
  if (toolBoundary.counts.unknown > 0) return "alert";
  if (toolBoundary.consistencyIssues.some((i) => i.severity === "critical")) {
    return "alert";
  }
  if (toolBoundary.consistencyIssues.some((i) => i.severity === "warning")) {
    return "watch";
  }
  return "healthy";
}

/** Reporting-crew node status mirrors the briefing status. */
export function deriveReportingStatus(
  briefing: ReportingCrewBriefing | null,
): AgenticSystemNodeStatus {
  if (!briefing) return "no_data";
  switch (briefing.status) {
    case "alert":
      return "alert";
    case "watch":
      return "watch";
    case "no_data":
      return "no_data";
    default:
      return "healthy";
  }
}
