// Admin · Agentic Control Tower — Router Observability (presentational).
//
// READ-ONLY. Rewritten 2026-06-26 to fit the line/table console: a collapsible
// group with an inline status + window selector, the stat counters as a facts
// line, and the recent decisions as the shared dense table. No box grids, no
// hardcoded values, honest empty/unavailable lines. Pure component.

import Link from "next/link";
import { cn } from "@/lib/cn";
import { AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import { RouterObservabilityTrends } from "@/components/admin/agentic/router-observability-trends";
import { RouterObservabilityLongTerm } from "@/components/admin/agentic/router-observability-longterm";
import { RouterQualityReview } from "@/components/admin/agentic/router-quality-review";
import type {
  RouterDecisionTrace,
  RouterObservabilityAggregationMode,
  RouterObservabilitySummary,
  RouterObservabilityStorage,
  RouterObservabilityWindow,
} from "@/lib/agentic/observability/types";

const OUTCOME_LABEL: Record<string, string> = {
  nav_fast_path: "nav fast-path",
  negated_no_nav: "negated",
  dangerous_refusal: "refusal",
  educational_llm: "educational",
  normal_llm: "normal",
  legacy_fallback_nav: "fallback nav",
  unknown: "unknown",
};

function outcomeTone(outcome: string): AgenticTone {
  switch (outcome) {
    case "nav_fast_path":
    case "educational_llm":
      return "success";
    case "dangerous_refusal":
      return "danger";
    case "negated_no_nav":
    case "legacy_fallback_nav":
      return "warning";
    default:
      return "neutral";
  }
}

const WINDOWS: { value: RouterObservabilityWindow; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const STORAGE_LABEL: Record<RouterObservabilityStorage, string> = {
  durable: "durable",
  redis_fallback: "redis fallback",
  memory_fallback: "memory fallback",
  unavailable: "unavailable",
};

function storageTone(storage: RouterObservabilityStorage): AgenticTone {
  if (storage === "durable") return "success";
  if (storage === "unavailable") return "danger";
  return "warning";
}

const AGGREGATION_LABEL: Record<RouterObservabilityAggregationMode, string> = {
  sql: "SQL aggregates",
  in_memory: "in-memory fallback",
  fallback: "in-memory fallback",
};

/** Time-window pill selector — exported so the canon section card can host it
 *  in its header trailing slot (the section body itself is now frameless). */
export function ObservabilityWindowSelector({
  current,
}: {
  current: RouterObservabilityWindow;
}) {
  return (
    <span className="agentic-windowbar" role="group" aria-label="Time window">
      {WINDOWS.map((w) => (
        <Link
          key={w.value}
          href={`?routerWindow=${w.value}`}
          aria-current={w.value === current ? "true" : undefined}
          className={cn("ct-pill body-xs", w.value === current ? "accent" : "ct-text-muted")}
        >
          {w.label}
        </Link>
      ))}
    </span>
  );
}

function shortTime(iso: string): string {
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t ? t.replace("Z", "").slice(0, 8) : iso;
}

function DecisionRow({ trace }: { trace: RouterDecisionTrace }) {
  return (
    <tr>
      <td className="agentic-cell-faint tabular-nums whitespace-nowrap">
        {shortTime(trace.createdAt)}
      </td>
      <td className="agentic-cell-strong">{trace.kind}</td>
      <td className="agentic-cell-muted">{trace.actionPolicy}</td>
      <td className="whitespace-nowrap">
        <AgenticTag tone={outcomeTone(trace.outcome)}>
          {OUTCOME_LABEL[trace.outcome] ?? trace.outcome}
        </AgenticTag>
        {trace.negated && <span className="agentic-cell-faint"> · negated</span>}
      </td>
      <td className="agentic-cell-muted tabular-nums">
        {typeof trace.confidence === "number" ? trace.confidence.toFixed(2) : "—"}
      </td>
      <td className="agentic-cell-muted agentic-cell-mono">{trace.routeKey ?? "—"}</td>
    </tr>
  );
}

export function RouterObservabilitySection({
  summary,
}: {
  summary: RouterObservabilitySummary | null;
}) {
  if (!summary || summary.state === "unavailable") {
    return (
      <div id="router-observability" className="agentic-group-body min-w-0 border-t-0 p-5">
        <p className="agentic-section-caption m-0">
          <AgenticTag tone="danger">unavailable</AgenticTag>
        </p>
        <p className="agentic-empty-line m-0">
          Router trace storage is unavailable. Router behaviour is unaffected.
        </p>
      </div>
    );
  }

  const {
    state,
    storage,
    recent,
    stats,
    privacyMode,
    retentionNote,
    window: activeWindow,
    retentionPolicyNote,
    windowLimitationNote,
    aggregationMode,
  } = summary;

  const facts: { id: string; label: string; value: number; tone?: AgenticTone }[] = [
    { id: "total", label: "Decisions", value: stats.total },
    { id: "nav", label: "Nav fast-paths", value: stats.navigationFastPaths, tone: "success" },
    { id: "refusal", label: "Dangerous refusals", value: stats.dangerousRefusals, tone: "danger" },
    { id: "edu", label: "Educational", value: stats.educationalTurns, tone: "success" },
    { id: "negated", label: "Negated", value: stats.negatedNoNav, tone: "warning" },
    {
      id: "normal",
      label: "Normal / unknown",
      value: (stats.byOutcome.normal_llm ?? 0) + (stats.byOutcome.unknown ?? 0),
    },
  ];

  return (
    <div
      id="router-observability"
      className="agentic-group-body flex min-w-0 flex-col gap-3 border-t-0 p-5"
    >
      {/* Status strip — inline tags, one line. */}
      <p className="agentic-section-caption">
        <AgenticTag tone={state === "enabled" ? "success" : "neutral"}>{state}</AgenticTag>{" "}
        <AgenticTag tone={storageTone(storage)}>
          {storage === "durable" && activeWindow === "30d" ? "durable 30d" : STORAGE_LABEL[storage]}
        </AgenticTag>{" "}
        {aggregationMode && aggregationMode !== "sql" && (
          <AgenticTag tone="warning">{AGGREGATION_LABEL[aggregationMode]}</AgenticTag>
        )}{" "}
        <span className="agentic-cell-faint">
          {privacyMode}
          {retentionNote ? ` · ${retentionNote}` : ""}
          {windowLimitationNote ? ` · ${windowLimitationNote}` : ""}
          {retentionPolicyNote ? ` · ${retentionPolicyNote}` : ""}
        </span>
      </p>

      {/* Counters as a facts line. */}
      <header className="agentic-statusline" aria-label="Observability counters">
        {facts.map((f) => (
          <span key={f.id} className="agentic-statusline-fact">
            <span className="agentic-statusline-fact-value" data-tone={f.tone}>
              {f.value}
            </span>
            <span className="agentic-statusline-fact-label">{f.label}</span>
          </span>
        ))}
      </header>

      {/* Recent decisions — shared dense table. */}
      {state === "empty" || recent.length === 0 ? (
        <p className="agentic-empty-line m-0">
          No router traces in this window. Send chat traffic or widen the window.
        </p>
      ) : (
        <table className="agentic-table">
          <thead>
            <tr>
              {["Time", "Kind", "Policy", "Outcome", "Conf.", "Route"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <DecisionRow key={t.id} trace={t} />
            ))}
          </tbody>
        </table>
      )}

      {state === "enabled" && recent.length > 0 && (
        <RouterObservabilityTrends
          window={summary.trendWindow}
          buckets={summary.trendBuckets}
          topMatchedRules={summary.topMatchedRules}
          bufferLimitNote={summary.bufferLimitNote}
        />
      )}

      <RouterQualityReview review={summary.qualityReview} />

      {summary.longTerm && <RouterObservabilityLongTerm longTerm={summary.longTerm} />}
    </div>
  );
}
