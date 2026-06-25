// Reporting Crew Read-Only v0 — briefing composition (pure, deterministic).
//
// Composes the read-only inputs into a structured ReportingCrewBriefing: an
// executive summary, the section breakdown (router / tool boundary / safety /
// observability / watchlist), recommended read-only checks, and safety notes.
// Deterministic: same input → same output. No I/O, no Date.now, no mutation.

import type {
  ReportingCrewBriefing,
  ReportingCrewInputs,
  ReportingCrewMetric,
  ReportingCrewSection,
  ReportingCrewSignal,
  ReportingCrewStatus,
} from "./types";
import {
  deriveRouterSignals,
  deriveToolBoundarySignals,
  deriveSafetySignals,
  deriveNoDataSignals,
} from "./quality-signals";
import { buildRecommendedReadOnlyChecks } from "./recommendations";

/** Static marker — NOT a live timestamp (pure code has no Date.now). */
const GENERATED_AT = "read-only composition (static marker)";

const SAFETY_NOTES: string[] = [
  "Read-only composition only. No tools are executed, no writes are performed, and no prompts, user messages, or tool payloads are stored.",
  "Not CrewAI and not an autonomous runtime — this is a deterministic briefing over data the platform already produces.",
  "Every recommendation is a read-only verification; none enables a write, send, deploy, source, or mark-live action.",
];

/** The worst severity across a set of signals → the section/overall status. */
function worstSeverity(
  signals: readonly ReportingCrewSignal[],
): "healthy" | "watch" | "alert" {
  if (signals.some((s) => s.severity === "alert")) return "alert";
  if (signals.some((s) => s.severity === "watch")) return "watch";
  return "healthy";
}

function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/** Build the Router Health section. */
function routerSection(
  inputs: ReportingCrewInputs,
  routerSignals: readonly ReportingCrewSignal[],
): ReportingCrewSection {
  const { router } = inputs.controlCenter;
  const obs = inputs.observability;
  const review = obs?.qualityReview;
  const metrics: ReportingCrewMetric[] = [
    {
      id: "router-status",
      label: "Router",
      value: `${router.status} · ${router.mode}`,
      detail: router.version,
    },
  ];
  if (review) {
    const rateOf = (key: string) =>
      review.rates.find((r) => r.key === key)?.rate ?? 0;
    metrics.push(
      {
        id: "unknown-rate",
        label: "Unknown rate",
        value: pct(rateOf("unknown")),
        detail: `over ${review.total} decisions`,
      },
      {
        id: "dangerous-refusal-rate",
        label: "Dangerous-refusal rate",
        value: pct(rateOf("dangerous_refusal")),
      },
      {
        id: "educational-rate",
        label: "Educational rate",
        value: pct(rateOf("educational")),
      },
    );
  }
  if (obs) {
    metrics.push({
      id: "observability-source",
      label: "Observability source",
      value: `${obs.storage}${obs.aggregationMode ? ` / ${obs.aggregationMode}` : ""}`,
    });
  }
  return {
    id: "router-health",
    title: "Router Health",
    summary: review
      ? `Deterministic router is ${router.status} (${router.mode}); quality review over ${review.total} decisions with ${review.activeSignalCount} active signal(s).`
      : `Deterministic router is ${router.status} (${router.mode}); no windowed quality review available.`,
    metrics,
    signals: [...routerSignals],
  };
}

/** Build the Tool Boundary Health section. */
function toolBoundarySection(
  inputs: ReportingCrewInputs,
  toolSignals: readonly ReportingCrewSignal[],
): ReportingCrewSection {
  const tb = inputs.controlCenter.toolBoundaryV1;
  const metrics: ReportingCrewMetric[] = [];
  if (tb) {
    metrics.push(
      { id: "read-tools", label: "Read-only", value: String(tb.counts.read_only) },
      {
        id: "draft-tools",
        label: "Draft / proposal",
        value: String(tb.counts.draft_or_proposal),
      },
      {
        id: "confirmed-write-tools",
        label: "Confirmed-write",
        value: String(tb.counts.confirmed_write),
      },
      { id: "unknown-tools", label: "Unknown", value: String(tb.counts.unknown) },
      {
        id: "consistency-issues",
        label: "Consistency issues",
        value: String(tb.consistencyIssues.length),
        detail: `${tb.consistencyIssues.filter((i) => i.severity === "critical").length} critical`,
      },
    );
  }
  return {
    id: "tool-boundary-health",
    title: "Tool Boundary Health",
    summary: tb
      ? `${tb.counts.read_only} read · ${tb.counts.draft_or_proposal} draft · ${tb.counts.confirmed_write} confirmed-write · ${tb.counts.unknown} unknown; ${tb.consistencyIssues.length} consistency issue(s).`
      : "Tool boundary reflection is not available in this build.",
    metrics,
    signals: [...toolSignals],
  };
}

/** Build the Safety & Gates section. */
function safetySection(
  inputs: ReportingCrewInputs,
  safetySignals: readonly ReportingCrewSignal[],
): ReportingCrewSection {
  const cc = inputs.controlCenter;
  const gatesAutonomous = cc.gates.filter((g) => g.autonomousAllowed).length;
  const safetyHold = cc.safetySummary.filter((s) => s.holds).length;
  const forbiddenActions =
    cc.toolBoundaryV1?.tools.filter((t) => t.tier === "forbidden_autonomous")
      .length ?? 0;
  return {
    id: "safety-gates",
    title: "Safety & Gates",
    summary: `${safetyHold}/${cc.safetySummary.length} safety claims hold; ${gatesAutonomous} gate(s) allow autonomous action; ${forbiddenActions} forbidden-autonomous action(s) represented.`,
    metrics: [
      {
        id: "safety-claims",
        label: "Safety claims hold",
        value: `${safetyHold}/${cc.safetySummary.length}`,
      },
      {
        id: "autonomous-gates",
        label: "Autonomous gates",
        value: String(gatesAutonomous),
        detail: "expected 0",
      },
      {
        id: "forbidden-actions",
        label: "Forbidden actions represented",
        value: String(forbiddenActions),
      },
    ],
    signals: [...safetySignals],
  };
}

/** Build the Observability Signals section. */
function observabilitySection(
  inputs: ReportingCrewInputs,
): ReportingCrewSection {
  const obs = inputs.observability;
  const review = obs?.qualityReview;
  const metrics: ReportingCrewMetric[] = [];
  if (obs) {
    metrics.push(
      { id: "obs-state", label: "State", value: obs.state },
      { id: "obs-window", label: "Window", value: obs.window },
      {
        id: "obs-total",
        label: "Decisions in window",
        value: String(obs.stats.total),
      },
    );
    if (review) {
      metrics.push({
        id: "obs-active-signals",
        label: "Active quality signals",
        value: String(review.activeSignalCount),
      });
    }
  }
  return {
    id: "observability-signals",
    title: "Observability Signals",
    summary: obs
      ? `Trace storage ${obs.storage}; window ${obs.window}; ${obs.stats.total} decision(s); state ${obs.state}.`
      : "No observability summary available — this section reflects limited data.",
    metrics,
    // Observability-specific signals already folded into routerSignals; keep this
    // section metric-led to avoid duplicating the same signal rows twice.
    signals: [],
  };
}

/**
 * Compose the full read-only briefing. Deterministic + pure. `status` is the
 * worst severity across every section signal, with `no_data` when key inputs are
 * missing AND there are no actionable watch/alert signals.
 */
export function composeReportingCrewBriefing(
  inputs: ReportingCrewInputs,
): ReportingCrewBriefing {
  const routerSignals = deriveRouterSignals(inputs.observability);
  const toolSignals = deriveToolBoundarySignals(
    inputs.controlCenter.toolBoundaryV1,
  );
  const safetySignals = deriveSafetySignals(inputs.controlCenter);

  const allSignals = [...routerSignals, ...toolSignals, ...safetySignals];
  const worst = worstSeverity(allSignals);

  // no_data when there is no observability summary AND nothing rises above info.
  const hasObservabilityData =
    inputs.observability !== null &&
    inputs.observability.state !== "unavailable";
  const noDataSignals = hasObservabilityData
    ? []
    : deriveNoDataSignals({
        observability: inputs.observability,
        toolBoundary: inputs.controlCenter.toolBoundaryV1,
      });

  let status: ReportingCrewStatus;
  if (worst === "alert") status = "alert";
  else if (worst === "watch") status = "watch";
  else if (!hasObservabilityData) status = "no_data";
  else status = "healthy";

  const sections: ReportingCrewSection[] = [
    routerSection(inputs, routerSignals),
    toolBoundarySection(inputs, toolSignals),
    safetySection(inputs, safetySignals),
    observabilitySection(inputs),
  ];

  // Watchlist — every watch/alert signal across sections, plus no_data info notes.
  const watchlistSignals = [
    ...allSignals.filter(
      (s) => s.severity === "watch" || s.severity === "alert",
    ),
    ...noDataSignals,
  ];
  sections.push({
    id: "watchlist",
    title: "Watchlist",
    summary:
      watchlistSignals.length === 0
        ? "No watch or alert signals — the agentic surface looks healthy from the read-only data."
        : `${watchlistSignals.filter((s) => s.severity === "alert").length} alert · ${watchlistSignals.filter((s) => s.severity === "watch").length} watch signal(s) to review.`,
    metrics: [],
    signals: watchlistSignals,
  });

  const recommendedReadOnlyChecks = buildRecommendedReadOnlyChecks({
    controlCenter: inputs.controlCenter,
    observability: inputs.observability,
    signals: allSignals,
  });

  const executiveSummary = buildExecutiveSummary(status, inputs, allSignals);

  return {
    generatedAt: GENERATED_AT,
    mode: "read_only",
    status,
    executiveSummary,
    sections,
    recommendedReadOnlyChecks,
    safetyNotes: SAFETY_NOTES,
  };
}

/** Plain-language executive summary derived from the status + key inputs. Pure. */
function buildExecutiveSummary(
  status: ReportingCrewStatus,
  inputs: ReportingCrewInputs,
  signals: readonly ReportingCrewSignal[],
): string {
  const router = inputs.controlCenter.router;
  const tb = inputs.controlCenter.toolBoundaryV1;
  const alerts = signals.filter((s) => s.severity === "alert").length;
  const watches = signals.filter((s) => s.severity === "watch").length;

  const head =
    status === "alert"
      ? `Attention: ${alerts} alert signal(s) need review.`
      : status === "watch"
        ? `Mostly healthy with ${watches} signal(s) to watch.`
        : status === "no_data"
          ? "Limited data — the agentic surface is configured safely, but there is not enough recent activity to assess health."
          : "The agentic surface looks healthy from the read-only data.";

  const routerPart = `Router is ${router.status} (${router.mode}).`;
  const toolPart = tb
    ? `Tools: ${tb.counts.read_only} read, ${tb.counts.draft_or_proposal} draft, ${tb.counts.confirmed_write} confirmed-write, ${tb.counts.unknown} unknown; every write is gated and non-autonomous.`
    : "Tool boundary reflection unavailable.";
  const safetyPart =
    "No autonomous deploy / send / source / mark-live is reachable from the chat; all writes are HITL-gated.";

  return `${head} ${routerPart} ${toolPart} ${safetyPart}`;
}
