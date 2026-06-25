// Admin · Agentic Control Center — Router Observability section (presentational).
//
// READ-ONLY. Renders a RouterObservabilitySummary: a status strip, stat cards, a
// recent-decisions table, and a safety note. NO write controls, NO action
// buttons, NO fake data. When the summary is null (read failed) or its state is
// "unavailable", it renders an honest unavailable card; when "empty", an honest
// empty card. Pure component — all data is passed in, so it is unit-testable.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RouterObservabilityTrends } from "@/components/admin/agentic/router-observability-trends";
import type {
  RouterDecisionTrace,
  RouterObservabilitySummary,
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

function outcomeTone(
  outcome: string,
): "success" | "warning" | "danger" | "default" {
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

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
      <span className="stat-label ct-text-muted">{label}</span>
      <span className="h3 m-0 tabular-nums">{value}</span>
    </Card>
  );
}

function shortTime(iso: string): string {
  // Render HH:MM:SS from an ISO timestamp without pulling a date lib. Falls back
  // to the raw string if it is not parseable.
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
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-faint break-words">
        {trace.matchedRuleIds.length > 0 ? trace.matchedRuleIds.join(", ") : "—"}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted font-mono break-words">
        {trace.routeKey ?? "—"}
      </td>
      <td className="py-[var(--ct-space-2)] body-xs ct-text-faint whitespace-nowrap">
        {trace.source}
      </td>
    </tr>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="router-observability"
      className="admin-doc-stack"
      aria-label="Router Observability"
    >
      <h2 className="h2">Router Observability</h2>
      <p className="body-xs ct-text-muted">
        Live, read-only metadata about what the deterministic router actually did
        on recent chat turns. Metadata only — no message text, no prompts, no
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
  // Read failed entirely → honest unavailable card.
  if (!summary || summary.state === "unavailable") {
    return (
      <SectionShell>
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--start">
            <Badge variant="warning">unavailable</Badge>
            <span className="flex-1" />
          </div>
          <p className="body-xs ct-text-muted">
            Router trace storage is unavailable in v0 because no safe existing
            persistence was found without a schema change. Router behaviour is
            unaffected; only this read-only view is empty.
          </p>
          <p className="body-xs ct-text-faint">{SAFETY_NOTE_FALLBACK}</p>
        </Card>
      </SectionShell>
    );
  }

  const { state, storage, recent, stats, safetyNote, privacyMode } = summary;

  return (
    <SectionShell>
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
          <Badge variant="default">storage: {storage}</Badge>
          <Badge variant="accent">source: cockpit_chat</Badge>
          <span className="flex-1" />
        </div>
        <p className="body-xs ct-text-faint">Privacy mode: {privacyMode}</p>
      </Card>

      {/* Stat cards */}
      <div className="admin-doc-card-grid-3">
        <StatChip label="Recent decisions" value={stats.total} />
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

      {/* Trends (v0.1) — derived from the same buffer; only when there is data */}
      {state === "enabled" && summary.trendBuckets && summary.trendWindow && (
        <RouterObservabilityTrends
          window={summary.trendWindow}
          buckets={summary.trendBuckets}
          topMatchedRules={summary.topMatchedRules ?? []}
          bufferLimitNote={
            summary.bufferLimitNote ??
            "Trends are computed from the capped v0 router trace buffer: max 200 traces, TTL 7 days."
          }
        />
      )}

      {/* Recent decisions table OR empty state */}
      {state === "empty" || recent.length === 0 ? (
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <Badge variant="default">empty</Badge>
          <p className="body-xs ct-text-muted">
            No router traces recorded yet. Send chat traffic to populate this
            read-only view.
          </p>
        </Card>
      ) : (
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
                  "Matched rules",
                  "Route key",
                  "Source",
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
