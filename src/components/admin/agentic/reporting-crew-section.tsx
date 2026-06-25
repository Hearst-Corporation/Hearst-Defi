// Admin · Agentic Control Center — Reporting Crew Read-Only v0 (presentational).
//
// READ-ONLY. Renders the deterministic briefing: a status badge, an executive
// summary, per-section metric cards + signals, a watchlist, recommended read-only
// checks, and a safety note. NO write controls, NO action buttons, NO run / send /
// deploy / source / execute — nothing here can act. Pure component; all data
// passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  ReportingCrewBriefing,
  ReportingCrewSection,
  ReportingCrewSignal,
  ReportingCrewSignalSeverity,
  ReportingCrewStatus,
} from "@/lib/agentic/reporting/types";

type Tone = "success" | "warning" | "danger" | "default" | "accent";

function statusTone(status: ReportingCrewStatus): Tone {
  switch (status) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    case "alert":
      return "danger";
    default:
      return "default";
  }
}

function severityTone(severity: ReportingCrewSignalSeverity): Tone {
  switch (severity) {
    case "alert":
      return "danger";
    case "watch":
      return "warning";
    case "healthy":
      return "success";
    default:
      return "default";
  }
}

const STATUS_LABEL: Record<ReportingCrewStatus, string> = {
  healthy: "healthy",
  watch: "watch",
  alert: "alert",
  no_data: "no data",
};

function SignalRow({ signal }: { signal: ReportingCrewSignal }) {
  return (
    <li className="admin-doc-inline-row admin-doc-inline-row--start align-top">
      <Badge variant={severityTone(signal.severity)}>{signal.severity}</Badge>
      <span className="body-xs flex-1">
        <span className="ct-text-strong">{signal.title}</span>
        <span className="ct-text-muted"> — {signal.detail}</span>
        <span className="ct-text-faint"> ({signal.source})</span>
      </span>
    </li>
  );
}

function SectionCard({ section }: { section: ReportingCrewSection }) {
  return (
    <Card
      hoverOverlay={false}
      contentClassName="flex h-full flex-col gap-[var(--ct-space-3)]"
    >
      <h4 className="h4 m-0">{section.title}</h4>
      <p className="body-xs ct-text-muted">{section.summary}</p>
      {section.metrics.length > 0 && (
        <div className="flex flex-wrap gap-[var(--ct-space-2)]">
          {section.metrics.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-[var(--ct-space-1)] min-w-[7rem]"
            >
              <span className="stat-label ct-text-muted">{m.label}</span>
              <span className="body-sm ct-text-strong tabular-nums">{m.value}</span>
              {m.detail && (
                <span className="body-xs ct-text-faint">{m.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {section.signals.length > 0 && (
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {section.signals.map((s) => (
            <SignalRow key={s.id} signal={s} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ReportingCrewSection({
  briefing,
}: {
  briefing: ReportingCrewBriefing | null | undefined;
}) {
  if (!briefing) return null;

  const {
    status,
    executiveSummary,
    sections,
    recommendedReadOnlyChecks,
    safetyNotes,
  } = briefing;

  // Watchlist is rendered with its own emphasis; other sections in the grid.
  const watchlist = sections.find((s) => s.id === "watchlist");
  const gridSections = sections.filter((s) => s.id !== "watchlist");

  return (
    <section
      id="reporting-crew"
      className="admin-doc-stack"
      aria-label="Reporting Crew read-only briefing"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">Reporting Crew</h2>
        <span className="flex-1" />
        <Badge variant="accent">read-only briefing</Badge>
        <Badge variant={statusTone(status)}>{STATUS_LABEL[status]}</Badge>
      </div>

      {/* Executive summary */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <span className="stat-label ct-text-muted">Executive summary</span>
        <p className="body-sm ct-text-body">{executiveSummary}</p>
      </Card>

      {/* Section breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
        {gridSections.map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>

      {/* Watchlist */}
      {watchlist && (
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--start">
            <span className="stat-label ct-text-muted">Watchlist</span>
            <span className="flex-1" />
            <Badge
              variant={watchlist.signals.length === 0 ? "success" : "warning"}
            >
              {watchlist.signals.length === 0
                ? "clear"
                : `${watchlist.signals.length} signal${watchlist.signals.length > 1 ? "s" : ""}`}
            </Badge>
          </div>
          <p className="body-xs ct-text-muted">{watchlist.summary}</p>
          {watchlist.signals.length > 0 && (
            <ul className="flex flex-col gap-[var(--ct-space-2)]">
              {watchlist.signals.map((s) => (
                <SignalRow key={s.id} signal={s} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Recommended read-only checks */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <span className="stat-label ct-text-muted">
          Recommended read-only checks
        </span>
        <ul className="flex flex-col gap-[var(--ct-space-1)]">
          {recommendedReadOnlyChecks.map((c) => (
            <li key={c} className="body-xs ct-text-muted">
              · {c}
            </li>
          ))}
        </ul>
      </Card>

      {/* Safety note */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-1)]"
      >
        <span className="stat-label ct-text-muted">Safety</span>
        <ul className="flex flex-col gap-[var(--ct-space-1)]">
          {safetyNotes.map((n) => (
            <li key={n} className="body-xs ct-text-muted">
              · {n}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
