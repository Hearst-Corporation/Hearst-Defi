// Reporting Crew Read-Only v0 — signal derivation (pure, read-only).
//
// Turns the read-only inputs into briefing SIGNALS. Every helper is pure: it
// reads counts/flags/rates already computed elsewhere and emits info/watch/alert
// observations. It never executes a tool, never writes, never mutates inputs.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ToolBoundaryV1Summary } from "@/lib/agentic/tool-boundary/types";
import type { ReportingCrewSignal } from "./types";

/**
 * Router signals from the observability summary + its quality review. `alert` for
 * an active critical-ish quality signal (dangerous-refusal); `watch` for high
 * unknown / fallback / no-recent-data; `info` for a degraded/empty source.
 */
export function deriveRouterSignals(
  observability: RouterObservabilitySummary | null,
): ReportingCrewSignal[] {
  const signals: ReportingCrewSignal[] = [];
  if (!observability) {
    signals.push({
      id: "router-observability-unavailable",
      title: "Router observability unavailable",
      severity: "info",
      detail:
        "The router observability read returned no summary. Router behaviour is unaffected; only this read-only view is empty.",
      source: "Router Observability",
    });
    return signals;
  }

  if (observability.state === "unavailable") {
    signals.push({
      id: "router-trace-storage-unavailable",
      title: "Trace storage unavailable",
      severity: "info",
      detail:
        "No router trace storage is reachable in this environment. Router behaviour is unaffected.",
      source: "Router Observability",
    });
  } else if (observability.state === "empty") {
    signals.push({
      id: "router-no-traces",
      title: "No router traces in the window",
      severity: "info",
      detail:
        "No router decisions recorded in the selected window. Send chat traffic or widen the window to populate the view.",
      source: "Router Observability",
    });
  }

  // Degraded storage source (Redis/memory fallback) → watch (numbers may be partial).
  if (
    observability.storage === "redis_fallback" ||
    observability.storage === "memory_fallback" ||
    observability.aggregationMode === "fallback"
  ) {
    signals.push({
      id: "router-storage-fallback",
      title: "Observability on a fallback source",
      severity: "watch",
      detail: `Served by ${observability.storage}${observability.aggregationMode ? ` / aggregation ${observability.aggregationMode}` : ""}. Durable store unreachable, so windowed numbers may be partial.`,
      source: "Router Observability",
    });
  }

  // Fold the quality-review watchlist into briefing signals (read-only).
  const review = observability.qualityReview;
  if (review) {
    for (const w of review.watchlist) {
      if (!w.active) continue;
      const severity =
        w.severity === "alert"
          ? "alert"
          : w.severity === "watch"
            ? "watch"
            : "info";
      signals.push({
        id: `quality:${w.key}`,
        title: w.label,
        severity,
        detail: w.detail,
        source: "Router Quality Review",
      });
    }
  }

  return signals;
}

/**
 * Tool-boundary signals from the v1 reflection. `alert` for unknown tools or any
 * critical consistency issue; `watch` for non-critical drift warnings.
 */
export function deriveToolBoundarySignals(
  toolBoundary: ToolBoundaryV1Summary | undefined,
): ReportingCrewSignal[] {
  const signals: ReportingCrewSignal[] = [];
  if (!toolBoundary) {
    signals.push({
      id: "tool-boundary-unavailable",
      title: "Tool boundary reflection unavailable",
      severity: "info",
      detail: "The tool boundary reflection is not present in this build.",
      source: "Tool Boundary",
    });
    return signals;
  }

  if (toolBoundary.counts.unknown > 0) {
    signals.push({
      id: "tool-boundary-unknown",
      title: "Unclassified tools present",
      severity: "alert",
      detail: `${toolBoundary.counts.unknown} real registry tool(s) have no boundary classification. They are treated as high-risk + non-autonomous until classified.`,
      source: "Tool Boundary",
    });
  }

  const critical = toolBoundary.consistencyIssues.filter(
    (i) => i.severity === "critical",
  );
  for (const i of critical) {
    signals.push({
      id: `tool-boundary-critical:${i.id}`,
      title: "Tool boundary safety violation",
      severity: "alert",
      detail: i.message,
      source: "Tool Boundary",
    });
  }

  const warnings = toolBoundary.consistencyIssues.filter(
    (i) => i.severity === "warning",
  );
  for (const i of warnings) {
    signals.push({
      id: `tool-boundary-warning:${i.id}`,
      title: "Tool boundary drift",
      severity: "watch",
      detail: i.message,
      source: "Tool Boundary",
    });
  }

  return signals;
}

/**
 * Safety / gate signals from the control-center safety summary + human gates.
 * `alert` if a safety claim does not hold, or a gate allows autonomous action.
 */
export function deriveSafetySignals(
  controlCenter: AgenticControlCenterData,
): ReportingCrewSignal[] {
  const signals: ReportingCrewSignal[] = [];

  for (const s of controlCenter.safetySummary) {
    if (!s.holds) {
      signals.push({
        id: `safety-fail:${s.id}`,
        title: `Safety claim does not hold: ${s.claim}`,
        severity: "alert",
        detail: s.evidence,
        source: "Safety Summary",
      });
    }
  }

  for (const g of controlCenter.gates) {
    if (g.autonomousAllowed) {
      signals.push({
        id: `gate-autonomous:${g.id}`,
        title: `Gate allows autonomous action: ${g.action}`,
        severity: "alert",
        detail: `${g.action} is marked autonomousAllowed=true — a critical action must never be autonomous.`,
        source: "Human Gates",
      });
    }
  }

  // Router not active / shadow flag alive → watch.
  const router = controlCenter.router;
  if (router.status !== "active" || router.mode !== "non-shadow") {
    signals.push({
      id: "router-not-active",
      title: "Router not active / non-shadow",
      severity: "watch",
      detail: `Router status=${router.status}, mode=${router.mode}. Expected active + non-shadow.`,
      source: "Router Status",
    });
  }
  if (router.shadowFlag.alive) {
    signals.push({
      id: "router-shadow-flag-alive",
      title: "Router shadow flag is alive",
      severity: "watch",
      detail: `${router.shadowFlag.name} is alive: ${router.shadowFlag.notes}`,
      source: "Router Status",
    });
  }

  return signals;
}

/**
 * No-data signals: an honest info note when key inputs are missing entirely, so
 * the briefing degrades to no_data rather than pretending everything is healthy.
 */
export function deriveNoDataSignals(
  inputs: {
    observability: RouterObservabilitySummary | null;
    toolBoundary: ToolBoundaryV1Summary | undefined;
  },
): ReportingCrewSignal[] {
  const signals: ReportingCrewSignal[] = [];
  if (!inputs.observability) {
    signals.push({
      id: "no-data-observability",
      title: "Observability data missing",
      severity: "info",
      detail: "No router observability summary — the briefing reflects limited data.",
      source: "Reporting Crew",
    });
  }
  signals.push({
    id: "admin-visual-qa-not-confirmed",
    title: "Admin visual QA not confirmed",
    severity: "info",
    detail:
      "This briefing is composed from server-side reads; an admin visual pass of the live page is recommended but not confirmed here.",
    source: "Reporting Crew",
  });
  return signals;
}
