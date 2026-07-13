"use client";

import { useState } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

import type { AssetKind } from "../_data/brand";
import { AssetBadge } from "./asset-badge";

/**
 * RebalancingFeed — rebalancing notifications, latest + "History" toggle.
 *
 * Default view: the LATEST rebalancing notification (one line). A "History"
 * toggle swaps the same footer region for a scrollable ledger of past events
 * WITHOUT growing the card: the list is capped by max-height + overflow-y, so
 * the box footprint is unchanged whether there are 3 or 30 events. Client
 * component (the toggle needs state); events are passed in from the server.
 *
 * Each row reads as a vault-LEVEL action: an optional bucket pictogram
 * (usdc / bitcoin / hearst) makes the asset touched legible at a glance, an
 * optional emphasised `metric` carries the number, and an optional `kind`
 * micro-label states honestly whether the row is estimated, rules-based, or a
 * recorded fact. The tone dot is kept alongside the pictogram for status.
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
  /** Vault bucket the action touched — drives the pictogram (usdc / bitcoin / hearst). */
  readonly bucket?: AssetKind;
  /** Emphasised figure for the row, e.g. "+7% / mo" or "3%". */
  readonly metric?: string;
  /** Honesty micro-label: what kind of number this is. */
  readonly kind?: "estimated" | "rules-based" | "recorded";
}

const TONE_COLOR: Record<RebalancingEvent["tone"], string> = {
  review: "var(--ct-status-warning)",
  done: "var(--ct-accent)",
  info: "var(--ct-status-info)",
};

const KIND_LABEL: Record<NonNullable<RebalancingEvent["kind"]>, string> = {
  estimated: "Estimated",
  "rules-based": "Rules-based",
  recorded: "Recorded",
};

/** Leading indicator: tone status dot + optional bucket pictogram. */
function RowMarker({
  tone,
  bucket,
  breathe = false,
}: {
  tone: RebalancingEvent["tone"];
  bucket?: AssetKind;
  breathe?: boolean;
}) {
  return (
    <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          breathe && "hyv-breathe",
        )}
        style={{ background: TONE_COLOR[tone] }}
      />
      {bucket ? <AssetBadge asset={bucket} size={16} /> : null}
    </span>
  );
}

/** Emphasised numeric figure for a row. */
function RowMetric({ metric }: { metric: string }) {
  return (
    <span className="shrink-0 text-[length:var(--ct-text-nano)] font-semibold ct-text-strong tabular-nums">
      {metric}
    </span>
  );
}

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
              <RowMarker tone={e.tone} bucket={e.bucket} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[length:var(--ct-text-nano)] ct-text-muted tabular-nums">
                    {e.at}
                  </span>
                  {e.metric ? <RowMetric metric={e.metric} /> : null}
                </div>
                <span className="text-[length:var(--ct-text-nano)] ct-text-body leading-snug">
                  {e.summary}
                </span>
                {e.kind ? (
                  <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
                    {KIND_LABEL[e.kind]}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : latest ? (
        /* Latest notification — single line. Pulse + "held for multisig" copy
           belong to the simulated sandbox only: a real record may already be
           executed, and the pulse is reserved for live-ish signals. */
        <div className="flex items-start gap-2 px-5 pb-3 pt-2">
          <RowMarker tone={latest.tone} bucket={latest.bucket} breathe={simulated} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 text-[length:var(--ct-text-nano)] ct-text-body leading-snug">
                {latest.summary}
              </span>
              {latest.metric ? <RowMetric metric={latest.metric} /> : null}
            </div>
            {latest.kind || simulated ? (
              <span className="text-[length:var(--ct-text-nano)] ct-text-muted leading-snug">
                {latest.kind ? KIND_LABEL[latest.kind] : null}
                {latest.kind && simulated ? " · " : null}
                {simulated ? "Held for multisig · never auto-executed." : null}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Honest sample rebalancing ledger for the /portfolio/preview sandbox.
 *
 * Vault-LEVEL actions (never per-investor), most-recent first. Every figure is
 * labelled by `kind` (estimated / rules-based / recorded) so nothing reads as a
 * guaranteed live number. Buckets map to the three vault assets. No red: a
 * pending action is tone "review" (amber), an actioned one "done" (accent), an
 * operational note "info" (neutral). Rendered by the page as:
 *   <RebalancingFeed events={PREVIEW_REBALANCING_EVENTS} provenance="simulated" />
 */
export const PREVIEW_REBALANCING_EVENTS: readonly RebalancingEvent[] = [
  {
    id: "rb-usdc-morpho",
    at: "This month",
    summary: "USDC via Morpho generated 7% this month",
    tone: "done",
    bucket: "usdc",
    metric: "+7% / mo",
    kind: "estimated",
  },
  {
    id: "rb-btc-return-mining",
    at: "3 weeks ago",
    summary: "Returned 3% from the BTC tactical bucket into mining",
    tone: "done",
    bucket: "bitcoin",
    metric: "3%",
    kind: "rules-based",
  },
  {
    id: "rb-mining-capacity",
    at: "Last month",
    summary: "Allocated additional capital to mining capacity",
    tone: "done",
    bucket: "hearst",
    kind: "estimated",
  },
  {
    id: "rb-yield-distributed",
    at: "Jun 2026",
    summary: "Yield distributed to vault participants",
    tone: "done",
    bucket: "usdc",
    kind: "recorded",
  },
  {
    id: "rb-btc-rebalance-review",
    at: "May 2026",
    summary: "Rebalanced tactical BTC into productive mining exposure",
    tone: "review",
    bucket: "bitcoin",
    kind: "rules-based",
  },
  {
    id: "rb-electricity-b3",
    at: "Apr 2026",
    summary: "Electricity funded from B3 USDC — no borrow triggered",
    tone: "info",
    bucket: "usdc",
    kind: "rules-based",
  },
];
