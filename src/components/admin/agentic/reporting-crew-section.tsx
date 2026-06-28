// Admin · Agentic Control Center — Reporting Crew Read-Only v0 (presentational).
//
// READ-ONLY. Renders the deterministic briefing: a status badge, an executive
// summary, per-section metric cards + signals, a watchlist, recommended read-only
// checks, and a safety note. NO write controls, NO action buttons, NO run / send /
// deploy / source / execute — nothing here can act. Pure component; all data
// passed in, unit-testable via SSR.
//
// Bento canon (Portfolio): black BentoPanel + hairline border, micro uppercase
// labels, single accent green (--ct-accent). Status / signal severity render as colored
// chips — healthy=accent green, watch=amber, alert=red, info/neutral=zinc.

import type { ReactNode } from "react";

import { BentoHeader, BentoPanel } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import type {
  ReportingCrewBriefing,
  ReportingCrewSection as ReportingCrewSectionData,
  ReportingCrewSignal,
  ReportingCrewSignalSeverity,
  ReportingCrewStatus,
} from "@/lib/agentic/reporting/types";

/** Bento chip tone — drives the border/bg/text triplet only. */
type ChipTone = "ok" | "warn" | "danger" | "neutral";

/** Single green (--ct-accent) for healthy; amber for watch, red for alert, zinc otherwise. */
const CHIP_TONE: Record<ChipTone, string> = {
  ok: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  danger: "border-red-400/30 bg-red-400/10 text-red-400",
  neutral: "border-white/10 bg-white/5 text-zinc-400",
};

function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        CHIP_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

function statusTone(status: ReportingCrewStatus): ChipTone {
  switch (status) {
    case "healthy":
      return "ok";
    case "watch":
      return "warn";
    case "alert":
      return "danger";
    default:
      return "neutral";
  }
}

function severityTone(severity: ReportingCrewSignalSeverity): ChipTone {
  switch (severity) {
    case "alert":
      return "danger";
    case "watch":
      return "warn";
    case "healthy":
      return "ok";
    default:
      return "neutral";
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
    <li className="flex items-start gap-2.5">
      <Chip tone={severityTone(signal.severity)}>{signal.severity}</Chip>
      <span className="flex-1 text-[13px] leading-snug">
        <span className="font-medium text-white">{signal.title}</span>
        <span className="text-zinc-400"> — {signal.detail}</span>
        <span className="text-zinc-600"> ({signal.source})</span>
      </span>
    </li>
  );
}

function SectionCard({ section }: { section: ReportingCrewSectionData }) {
  return (
    <BentoPanel>
      <BentoHeader title={section.title} subtitle={section.summary} as="h3" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        {section.metrics.length > 0 && (
          <div className="flex flex-wrap gap-px overflow-hidden rounded-lg bg-white/5">
            {section.metrics.map((m) => (
              <div
                key={m.id}
                className="flex min-w-[7rem] flex-1 flex-col gap-1.5 bg-surface-inset p-3"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  {m.label}
                </span>
                <span className="text-[14px] font-medium leading-none text-white tabular-nums">
                  {m.value}
                </span>
                {m.detail && (
                  <span className="text-[10px] text-zinc-600">{m.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {section.signals.length > 0 && (
          <ul className="flex flex-col gap-3">
            {section.signals.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </ul>
        )}
      </div>
    </BentoPanel>
  );
}

function NoteList({
  title,
  notes,
}: {
  title: string;
  notes: readonly string[];
}) {
  return (
    <BentoPanel>
      <BentoHeader title={title} as="h3" />
      <ul className="flex flex-col gap-2 p-5">
        {notes.map((n) => (
          <li
            key={n}
            className="flex gap-2 text-[12px] leading-snug text-zinc-500"
          >
            <span aria-hidden className="select-none text-zinc-600">
              ·
            </span>
            <span className="flex-1">{n}</span>
          </li>
        ))}
      </ul>
    </BentoPanel>
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
      className="flex flex-col gap-y-5"
      aria-label="Reporting Crew read-only briefing"
    >
      <BentoPanel>
        <BentoHeader
          title="Reporting Crew"
          subtitle="Read-only briefing composed from data the platform already produces. Nothing here executes a tool."
          trailing={
            <>
              <Chip tone="ok">read-only briefing</Chip>
              <Chip tone={statusTone(status)}>{STATUS_LABEL[status]}</Chip>
            </>
          }
        />
        <div className="p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
            Executive summary
          </span>
          <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-zinc-300">
            {executiveSummary}
          </p>
        </div>
      </BentoPanel>

      {/* Section breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {gridSections.map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>

      {/* Watchlist */}
      {watchlist && (
        <BentoPanel>
          <BentoHeader
            title="Watchlist"
            subtitle={watchlist.summary}
            as="h3"
            trailing={
              <Chip tone={watchlist.signals.length === 0 ? "ok" : "warn"}>
                {watchlist.signals.length === 0
                  ? "clear"
                  : `${watchlist.signals.length} signal${watchlist.signals.length > 1 ? "s" : ""}`}
              </Chip>
            }
          />
          {watchlist.signals.length > 0 && (
            <ul className="flex flex-col gap-3 p-5">
              {watchlist.signals.map((s) => (
                <SignalRow key={s.id} signal={s} />
              ))}
            </ul>
          )}
        </BentoPanel>
      )}

      {/* Recommended read-only checks */}
      <NoteList
        title="Recommended read-only checks"
        notes={recommendedReadOnlyChecks}
      />

      {/* Safety note */}
      <NoteList title="Safety" notes={safetyNotes} />
    </section>
  );
}
