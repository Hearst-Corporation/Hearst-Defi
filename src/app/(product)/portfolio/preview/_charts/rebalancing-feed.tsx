"use client";

import { useState } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * RebalancingFeed — rebalancing notifications, latest + "History" toggle.
 *
 * Default view: the LATEST rebalancing notification (one line). A "History"
 * toggle swaps the same footer region for a scrollable ledger of past events
 * WITHOUT growing the card: the list is capped by max-height + overflow-y, so
 * the box footprint is unchanged whether there are 3 or 30 events. Client
 * component (the toggle needs state); events are passed in from the server.
 *
 * `provenance` states what the events ARE (badge is never hardcoded here):
 *   - "simulated" (default) — sandbox/pilot sample data. Keeps the breathing
 *     dot + the "Held for multisig" advisory copy of the demo look.
 *   - anything else (e.g. "manual" for real RebalanceEvent rows) — real
 *     records: static dot, no advisory copy (a real executed event is not
 *     "held"), badge tells the truth.
 *
 * Token-only (--ct-*). Never red — amber = review, accent = actioned.
 */

export interface RebalancingEvent {
  readonly id: string;
  /** e.g. "Aug 2025" or a short timestamp label. */
  readonly at: string;
  /** One-line human summary of the rebalancing notification. */
  readonly summary: string;
  /** review = amber dot; done = accent dot; info = neutral. */
  readonly tone: "review" | "done" | "info";
}

const TONE_COLOR: Record<RebalancingEvent["tone"], string> = {
  review: "var(--ct-status-warning)",
  done: "var(--ct-accent)",
  info: "var(--ct-status-info)",
};

export function RebalancingFeed({
  events,
  provenance = "simulated",
}: {
  events: readonly RebalancingEvent[];
  /** What the events are — drives the badge, the pulse and the advisory copy. */
  provenance?: Provenance;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const latest = events[0];
  const simulated = provenance === "simulated";

  return (
    <div className="flex flex-col border-t border-[var(--ct-border-soft)]">
      {/* header row: title + History toggle + provenance */}
      <div className="flex items-center justify-between gap-2 px-5 pt-3">
        <span className="ct-bento-label">Rebalancing</span>
        <div className="flex items-center gap-2">
          {events.length > 1 ? (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-pressed={showHistory}
              className={cn(
                "ct-focus-ring rounded-full border px-2.5 py-0.5 text-[length:var(--ct-text-nano)] font-semibold uppercase tracking-wide transition-colors",
                showHistory
                  ? "border-[var(--ct-accent)] ct-text-strong"
                  : "border-[var(--ct-border-soft)] ct-text-muted hover:ct-text-body",
              )}
              style={showHistory ? { color: "var(--ct-accent)" } : undefined}
            >
              {showHistory ? "Latest" : "History"}
            </button>
          ) : null}
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
      </div>

      {showHistory ? (
        /* Scrollable ledger — capped height so the card never grows. */
        <ul className="scrollbar-thin flex max-h-[132px] flex-col gap-px overflow-y-auto px-5 pb-3 pt-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2 py-1.5">
              <span
                aria-hidden
                className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: TONE_COLOR[e.tone] }}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[length:var(--ct-text-nano)] ct-text-muted tabular-nums">
                  {e.at}
                </span>
                <span className="text-[length:var(--ct-text-nano)] ct-text-body leading-snug">
                  {e.summary}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : latest ? (
        /* Latest notification — single line. Pulse + "held for multisig" copy
           belong to the simulated sandbox only: a real record may already be
           executed, and the pulse is reserved for live-ish signals. */
        <div className="flex items-start gap-2 px-5 pb-3 pt-2">
          <span
            aria-hidden
            className={cn(
              "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              simulated && "hyv-breathe",
            )}
            style={{ background: TONE_COLOR[latest.tone] }}
          />
          <span className="ct-metric-caption min-w-0 flex-1 text-[length:var(--ct-text-nano)] leading-snug">
            <span className="ct-text-body">{latest.summary}</span>
            {simulated ? (
              <>
                {" "}
                <span className="ct-text-muted">Held for multisig · never auto-executed.</span>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
