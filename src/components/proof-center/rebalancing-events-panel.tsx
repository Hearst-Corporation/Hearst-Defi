import { REBALANCING_EVENTS_EMPTY } from "@/components/proof/empty-messages";
import { RebalancePtaiModalTrigger } from "@/components/proof-center/rebalance-ptai-modal-trigger";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofCenterRebalanceRow } from "@/lib/data/proof-center";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import type { ProofCenterSectionLedProps } from "./proof-center-types";
import { cleanRebalanceTriggerText } from "./formatters";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type RebalanceProvenance = "live" | "manual" | "stale";

function rebalanceProvenance(status: string): RebalanceProvenance {
  if (status === "executed") return "live";
  if (status === "pending" || status === "approved") return "manual";
  return "stale";
}

// Strongest → weakest. Panel badge takes the weakest event so a pending/approved/
// cancelled event never lets the header show "Live".
const REBALANCE_RANK: Record<RebalanceProvenance, number> = {
  live: 0,
  manual: 1,
  stale: 2,
};

function weakestRebalanceProvenance(
  kinds: readonly RebalanceProvenance[],
): RebalanceProvenance {
  return kinds.reduce((weakest, kind) =>
    REBALANCE_RANK[kind] > REBALANCE_RANK[weakest] ? kind : weakest,
  );
}

// Provenance dot — accent green = Live, neutral = Manual/Stale. Single accent
// (var(--ct-accent)); never a warning/danger colour for benign rebalance states.
const PROVENANCE_LABEL: Record<RebalanceProvenance, string> = {
  live: "Live",
  manual: "Manual",
  stale: "Stale",
};

const PROVENANCE_DOT: Record<RebalanceProvenance, string> = {
  live: "bg-[var(--ct-accent)]",
  manual: "bg-zinc-500",
  stale: "bg-zinc-600",
};

// Status pill — accent for the executed (terminal/healthy) state, quiet zinc
// chrome otherwise. No green other than var(--ct-accent).
const STATUS_PILL: Record<string, string> = {
  executed:
    "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  approved: "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-body)]",
  pending: "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
  cancelled: "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-faint)]",
};

function statusPillClass(status: string): string {
  return STATUS_PILL[status] ?? "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]";
}

const microLabel = "ct-bento-label";

interface RebalancingEventsPanelProps extends ProofCenterSectionLedProps {
  events: ReadonlyArray<ProofCenterRebalanceRow>;
}

export function RebalancingEventsPanel({
  events,
  sectionLed = false,
  bare = false,
}: RebalancingEventsPanelProps) {
  if (events.length === 0) {
    const empty = (
      <>
        {!bare && (
          <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
                Rebalancing events
              </h2>
              <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide">Awaiting first rebalance</p>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-body)]">{REBALANCING_EVENTS_EMPTY.message}</p>
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] max-w-sm">{REBALANCING_EVENTS_EMPTY.detail}</p>
        </div>
      </>
    );
    return bare ? (
      empty
    ) : (
      <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        {empty}
      </div>
    );
  }

  const panelProvenance = weakestRebalanceProvenance(
    events.map((event) => rebalanceProvenance(event.status)),
  );

  const inner = (
    <>
      {!bare && (
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
              {sectionLed ? "Rebalancing events" : "Vault operations"}
            </h2>
            <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide">
              {sectionLed
                ? `Last ${events.length} rule-triggered events (PTAI)`
                : "Rule-triggered events"}
            </p>
          </div>
          <span
            className="flex items-center gap-1.5 ct-bento-label"
            role="status"
            aria-label={`Data provenance: ${PROVENANCE_LABEL[panelProvenance]}`}
          >
            <span
              aria-hidden
              className={cn("inline-block h-1.5 w-1.5 rounded-full", PROVENANCE_DOT[panelProvenance])}
            />
            {PROVENANCE_LABEL[panelProvenance]}
          </span>
        </div>
      )}

      <ul aria-label="Recent rebalancing events" className="flex flex-col">
        {events.map((event) => {
          const eventProvenance = rebalanceProvenance(event.status);
          return (
            <li
              key={event.id}
              className="flex flex-col gap-3 px-5 py-4 border-b border-[var(--ct-border-soft)] last:border-b-0"
            >
              {/* Top row — rule + status pills, provenance dot */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded border border-[color-mix(in_srgb,var(--ct-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-2 py-0.5 font-mono text-[length:var(--ct-text-micro)] font-medium text-[var(--ct-accent)]">
                    {event.ruleId}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                      statusPillClass(event.status),
                    )}
                  >
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>
                <span
                  className="flex items-center gap-1.5 ct-bento-label shrink-0"
                  role="status"
                  aria-label={`Data provenance: ${PROVENANCE_LABEL[eventProvenance]}`}
                >
                  <span
                    aria-hidden
                    className={cn("inline-block h-1.5 w-1.5 rounded-full", PROVENANCE_DOT[eventProvenance])}
                  />
                  {PROVENANCE_LABEL[eventProvenance]}
                </span>
              </div>

              {/* Meta block — nested bento sub-panel */}
              <dl className="grid grid-cols-1 gap-2.5 rounded-lg bg-surface-inset p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className={microLabel}>Triggered</dt>
                  <dd className="text-[length:var(--ct-text-2xs)] font-mono text-[var(--ct-text-body)] text-right tabular-nums">
                    {dateFmt.format(event.triggeredAt)} UTC
                  </dd>
                </div>
                {event.status === "executed" ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className={microLabel}>Executed</dt>
                    <dd className="text-[length:var(--ct-text-2xs)] font-mono text-[var(--ct-text-body)] text-right tabular-nums">
                      {dateFmt.format(event.executedAt)} UTC
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <dt className={microLabel}>Trigger summary</dt>
                  <dd className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] leading-snug line-clamp-2">
                    {cleanRebalanceTriggerText(event.triggerText)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className={microLabel}>Tx hash</dt>
                  <dd className="text-right">
                    {event.txHash ? (
                      <a
                        href={`${EXPLORER_TX_BASE}${event.txHash}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)] hover:text-white transition-colors"
                        title={event.txHash}
                        aria-label={`View transaction ${event.txHash} on explorer`}
                      >
                        {abbreviateAddress(event.txHash)}
                      </a>
                    ) : (
                      <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">Pending execution</span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex justify-end">
                <RebalancePtaiModalTrigger event={event} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  return bare ? (
    inner
  ) : (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
      {inner}
    </div>
  );
}
