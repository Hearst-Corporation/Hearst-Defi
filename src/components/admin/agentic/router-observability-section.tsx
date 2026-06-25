// Admin · Agentic Control Center — Router Observability section (presentational).
//
// READ-ONLY. Renders a RouterObservabilitySummary (v1): a window selector, a
// status strip (durable / fallback), stat cards, an outcome distribution, a
// top-matched-rules list, a recent-decisions table, and a safety note. NO write
// controls, NO action buttons, NO fake data. Honest empty/unavailable states.
// Pure component — all data is passed in, so it is unit-testable. The only
// interactivity is plain <Link> navigation for the time window (no client JS).

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { RouterObservabilityTrends } from "@/components/admin/agentic/router-observability-trends";
import { RouterObservabilityLongTerm } from "@/components/admin/agentic/router-observability-longterm";
import type {
  RouterDecisionTrace,
  RouterObservabilityAggregationMode,
  RouterObservabilitySummary,
  RouterObservabilityStorage,
  RouterObservabilityWindow,
} from "@/lib/agentic/observability/types";

const OUTCOME_LABEL: Record<string, string> = {
  nav_fast_path: "nav fast-path",
  negated_no_nav: "negated · no nav",
  dangerous_refusal: "dangerous refusal",
  educational_llm: "educational",
  normal_llm: "normal LLM",
  legacy_fallback_nav: "legacy fallback nav",
  unknown: "unknown",
};

type Tone = "success" | "warning" | "danger" | "default";

function outcomeTone(outcome: string): Tone {
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
      return "default";
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

// Read-only label for how the window aggregate was computed (v1.2). SQL durable
// aggregates are the optimized path; in-memory / fallback are honest degradations.
const AGGREGATION_LABEL: Record<RouterObservabilityAggregationMode, string> = {
  sql: "SQL durable aggregates",
  in_memory: "fallback in-memory",
  fallback: "fallback in-memory",
};

function aggregationTone(mode: RouterObservabilityAggregationMode): Tone {
  return mode === "sql" ? "success" : "warning";
}

function WindowSelector({ current }: { current: RouterObservabilityWindow }) {
  return (
    <div
      className="admin-doc-inline-row admin-doc-inline-row--start"
      role="group"
      aria-label="Time window"
    >
      <span className="stat-label ct-text-muted">Window</span>
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

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
      <span className="stat-label ct-text-muted">{label}</span>
      <span className="h3 m-0 tabular-nums">{value}</span>
    </Card>
  );
}

// NOTE: the outcome distribution and top-matched-rules views are rendered by
// <RouterObservabilityTrends> (single source of truth, alongside the time-bucketed
// bars). The earlier inline versions here were dead code (defined, never rendered)
// after the durable+trends merge, so they were removed.

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
        {typeof trace.confidence === "number"
          ? trace.confidence.toFixed(2)
          : "—"}
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
      className="admin-doc-stack"
      aria-label="Router Observability"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">Router Observability</h2>
        <span className="flex-1" />
        <WindowSelector current={current} />
      </div>
      <p className="body-xs ct-text-muted">
        Durable, read-only metadata about what the deterministic router actually
        did on recent chat turns. Metadata only — no message text, no prompts, no
        secrets, no tool payloads, no writes.
      </p>
      {children}
    </section>
  );
}

const SAFETY_NOTE_FALLBACK =
  "Read-only router metadata. No prompts, no message text, no secrets, no tool payloads, no autonomous writes.";

export function RouterObservabilitySection({
  summary,
}: {
  summary: RouterObservabilitySummary | null;
}) {
  const current = summary?.window ?? "24h";

  // Read failed entirely / no store reachable → honest unavailable card.
  if (!summary || summary.state === "unavailable") {
    return (
      <SectionShell current={current}>
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--start">
            <Badge variant="danger">unavailable</Badge>
            <span className="flex-1" />
          </div>
          <p className="body-xs ct-text-muted">
            Router trace storage is unavailable right now. Router behaviour is
            unaffected; only this read-only view is empty.
          </p>
          <p className="body-xs ct-text-faint">{SAFETY_NOTE_FALLBACK}</p>
        </Card>
      </SectionShell>
    );
  }

  const {
    state,
    storage,
    recent,
    stats,
    safetyNote,
    privacyMode,
    retentionNote,
    window: activeWindow,
    retentionPolicyNote,
    windowLimitationNote,
    aggregationMode,
  } = summary;

  return (
    <SectionShell current={current}>
      {/* Status strip */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
          <span className="stat-label ct-text-muted">Status</span>
          <Badge variant={state === "enabled" ? "success" : "default"}>
            {state}
          </Badge>
          <Badge variant={storageTone(storage)}>
            storage:{" "}
            {storage === "durable" && activeWindow === "30d"
              ? "durable 30d"
              : STORAGE_LABEL[storage]}
          </Badge>
          <Badge variant="accent">source: cockpit_chat</Badge>
          {aggregationMode && (
            <Badge variant={aggregationTone(aggregationMode)}>
              aggregation: {AGGREGATION_LABEL[aggregationMode]}
            </Badge>
          )}
          <span className="flex-1" />
        </div>
        <p className="body-xs ct-text-faint">Privacy mode: {privacyMode}</p>
        <p className="body-xs ct-text-faint">{retentionNote}</p>
        {windowLimitationNote && (
          <div className="admin-doc-inline-row admin-doc-inline-row--start">
            <Badge variant="warning">limited</Badge>
            <p className="body-xs ct-text-muted flex-1">{windowLimitationNote}</p>
          </div>
        )}
      </Card>

      {/* Retention policy (read-only — no prune/delete controls) */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-1)]"
      >
        <span className="stat-label ct-text-muted">Retention policy</span>
        <p className="body-xs ct-text-muted">{retentionPolicyNote}</p>
      </Card>

      {/* Stat cards */}
      <div className="admin-doc-card-grid-3">
        <StatChip label="Total decisions" value={stats.total} />
        <StatChip label="Navigation fast-paths" value={stats.navigationFastPaths} />
        <StatChip label="Dangerous refusals" value={stats.dangerousRefusals} />
        <StatChip label="Educational turns" value={stats.educationalTurns} />
        <StatChip label="Negated · no nav" value={stats.negatedNoNav} />
        <StatChip
          label="Normal / unknown LLM"
          value={
            (stats.byOutcome.normal_llm ?? 0) + (stats.byOutcome.unknown ?? 0)
          }
        />
      </div>

      {/* Trends over time (durable, same traces) — only when there is data */}
      {state === "enabled" && recent.length > 0 && (
        <RouterObservabilityTrends
          window={summary.trendWindow}
          buckets={summary.trendBuckets}
          topMatchedRules={summary.topMatchedRules}
          bufferLimitNote={summary.bufferLimitNote}
        />
      )}

      {/* Empty state OR distribution + top rules + recent table */}
      {state === "empty" || recent.length === 0 ? (
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <Badge variant="default">empty</Badge>
          <p className="body-xs ct-text-muted">
            No router traces in this window. Send chat traffic (or widen the
            window) to populate this read-only view.
          </p>
        </Card>
      ) : (
        <>
          {/* Distribution + top rules are rendered by RouterObservabilityTrends
              above (single source of truth); here we show the recent table. */}
          <Card
            hoverOverlay={false}
            material="flat"
            contentClassName="overflow-x-auto"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--ct-border-strong)">
                  {[
                    "Time",
                    "Kind",
                    "Action policy",
                    "Outcome",
                    "Negated",
                    "Confidence",
                    "Route key",
                    "Matched rules",
                  ].map((h) => (
                    <th
                      key={h}
                      className="stat-label ct-text-muted whitespace-nowrap pb-[var(--ct-space-2)] pr-[var(--ct-space-3)]"
                    >
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
        </>
      )}

      {/* Long-term per-day aggregate over the durable table (v1.1). Independent
          of the selected window; renders its own honest unavailable/empty state. */}
      {summary.longTerm && (
        <RouterObservabilityLongTerm longTerm={summary.longTerm} />
      )}

      {/* Safety note */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-1)]"
      >
        <span className="stat-label ct-text-muted">Safety</span>
        <p className="body-xs ct-text-muted">{safetyNote}</p>
      </Card>
    </SectionShell>
  );
}
