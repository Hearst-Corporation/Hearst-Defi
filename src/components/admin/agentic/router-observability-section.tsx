// Admin · Agentic Control Tower — Router Observability section (presentational).
//
// READ-ONLY. Compact view of the RouterObservabilitySummary: a one-line status
// strip, stat cards, outcome trends, quality review, recent decisions table,
// and long-term view. No write controls, no fake data, honest empty states.
// Pure component — all data passed in, unit-testable.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
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

type Tone = "success" | "warning" | "danger" | "default";

function outcomeTone(outcome: string): Tone {
  switch (outcome) {
    case "nav_fast_path":
    case "educational_llm": return "success";
    case "dangerous_refusal": return "danger";
    case "negated_no_nav":
    case "legacy_fallback_nav": return "warning";
    default: return "default";
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

function storageTone(storage: RouterObservabilityStorage): Tone {
  if (storage === "durable") return "success";
  if (storage === "unavailable") return "danger";
  return "warning";
}

const AGGREGATION_LABEL: Record<RouterObservabilityAggregationMode, string> = {
  sql: "SQL aggregates",
  in_memory: "in-memory fallback",
  fallback: "in-memory fallback",
};

function WindowSelector({ current }: { current: RouterObservabilityWindow }) {
  return (
    <div className="agentic-obs-windows" role="group" aria-label="Time window">
      {WINDOWS.map((w) => (
        <Link
          key={w.value}
          href={`?routerWindow=${w.value}`}
          aria-current={w.value === current ? "true" : undefined}
          className={cn(
            "ct-pill body-xs",
            w.value === current ? "accent" : "ct-text-muted",
          )}
        >
          {w.label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="agentic-obs-stat">
      <span className="agentic-obs-stat-value tabular-nums">{value}</span>
      <span className="body-xs ct-text-muted">{label}</span>
    </div>
  );
}

function shortTime(iso: string): string {
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t ? t.replace("Z", "").slice(0, 8) : iso;
}

function DecisionRow({ trace }: { trace: RouterDecisionTrace }) {
  return (
    <tr className="border-b border-(--ct-border-soft) last:border-0 align-top">
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-faint tabular-nums whitespace-nowrap">
        {shortTime(trace.createdAt)}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-body">
        {trace.kind}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted">
        {trace.actionPolicy}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)]">
        <Badge variant={outcomeTone(trace.outcome)}>
          {OUTCOME_LABEL[trace.outcome] ?? trace.outcome}
        </Badge>
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted tabular-nums">
        {trace.negated ? "yes" : "—"}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted tabular-nums">
        {typeof trace.confidence === "number" ? trace.confidence.toFixed(2) : "—"}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted font-mono break-words">
        {trace.routeKey ?? "—"}
      </td>
      <td className="py-[var(--ct-space-2)] body-xs ct-text-faint break-words">
        {trace.matchedRuleIds.length > 0 ? trace.matchedRuleIds.join(", ") : "—"}
      </td>
    </tr>
  );
}

function SectionShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: RouterObservabilityWindow;
}) {
  return (
    <section
      id="router-observability"
      className="agentic-stack"
      aria-label="Router Observability"
    >
      <div className="agentic-section-head">
        <div className="agentic-obs-title-row">
          <h2 className="agentic-section-title m-0">Observability</h2>
          <WindowSelector current={current} />
        </div>
        <p className="body-sm ct-text-muted m-0">
          Read-only metadata about what the router did on recent chat turns. No message text, no secrets.
        </p>
      </div>
      {children}
    </section>
  );
}

export function RouterObservabilitySection({
  summary,
}: {
  summary: RouterObservabilitySummary | null;
}) {
  const current = summary?.window ?? "24h";

  if (!summary || summary.state === "unavailable") {
    return (
      <SectionShell current={current}>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <div className="agentic-obs-status-row">
            <Badge variant="danger">unavailable</Badge>
            <span className="body-xs ct-text-muted">
              Router trace storage is unavailable. Router behaviour is unaffected.
            </span>
          </div>
        </Card>
      </SectionShell>
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

  return (
    <SectionShell current={current}>
      {/* Compact status strip */}
      <div className="agentic-obs-status-strip">
        <Badge variant={state === "enabled" ? "success" : "default"}>{state}</Badge>
        <Badge variant={storageTone(storage)}>
          {storage === "durable" && activeWindow === "30d" ? "durable 30d" : STORAGE_LABEL[storage]}
        </Badge>
        {aggregationMode && (
          <Badge variant={aggregationMode === "sql" ? "success" : "warning"}>
            {AGGREGATION_LABEL[aggregationMode]}
          </Badge>
        )}
        <span className="body-xs ct-text-faint">{privacyMode}</span>
        <span className="body-xs ct-text-faint">{retentionNote}</span>
        {windowLimitationNote && (
          <span className="body-xs ct-text-muted">{windowLimitationNote}</span>
        )}
        {retentionPolicyNote && (
          <span className="body-xs ct-text-faint">{retentionPolicyNote}</span>
        )}
      </div>

      {/* Stat summary */}
      <div className="agentic-obs-stats">
        <StatCard label="Decisions" value={stats.total} />
        <StatCard label="Nav fast-paths" value={stats.navigationFastPaths} />
        <StatCard label="Dangerous refusals" value={stats.dangerousRefusals} />
        <StatCard label="Educational" value={stats.educationalTurns} />
        <StatCard label="Negated" value={stats.negatedNoNav} />
        <StatCard label="Normal / unknown" value={(stats.byOutcome.normal_llm ?? 0) + (stats.byOutcome.unknown ?? 0)} />
      </div>

      {state === "enabled" && recent.length > 0 && (
        <RouterObservabilityTrends
          window={summary.trendWindow}
          buckets={summary.trendBuckets}
          topMatchedRules={summary.topMatchedRules}
          bufferLimitNote={summary.bufferLimitNote}
        />
      )}

      <RouterQualityReview review={summary.qualityReview} />

      {state === "empty" || recent.length === 0 ? (
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <Badge variant="default">empty</Badge>
          <p className="body-xs ct-text-muted">
            No router traces in this window. Send chat traffic or widen the window.
          </p>
        </Card>
      ) : (
        <Card hoverOverlay={false} material="flat" contentClassName="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-(--ct-border-strong)">
                {["Time", "Kind", "Action policy", "Outcome", "Negated", "Confidence", "Route key", "Matched rules"].map((h) => (
                  <th key={h} className="stat-label ct-text-muted whitespace-nowrap pb-[var(--ct-space-2)] pr-[var(--ct-space-3)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <DecisionRow key={t.id} trace={t} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {summary.longTerm && <RouterObservabilityLongTerm longTerm={summary.longTerm} />}
    </SectionShell>
  );
}
