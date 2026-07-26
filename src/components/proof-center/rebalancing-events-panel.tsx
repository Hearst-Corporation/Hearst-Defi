import { RESERVE_EVENTS_EMPTY } from "@/components/proof/empty-messages";
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
  live: "bg-accent",
  manual: "bg-[var(--ct-text-muted)]",
  stale: "bg-[var(--ct-text-faint)]",
};

// Status pill — accent for the executed (terminal/healthy) state, quiet zinc
// chrome otherwise. No green other than var(--ct-accent).
const STATUS_PILL: Record<string, string> = {
  executed:
    "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-accent-ink",
  approved: "border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] text-muted",
  pending: "border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] text-muted",
  cancelled: "border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] text-subtle",
};

function statusPillClass(status: string): string {
  return STATUS_PILL[status] ?? "border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] text-muted";
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
          <div className="flex items-end justify-between p-5 border-b border-border-subtle">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xs font-bold text-muted uppercase tracking-[0.15em] leading-none">
                Reserve events
              </h2>
              <p className="text-xs text-subtle tracking-wide">Awaiting first reserve event</p>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="text-sm font-medium text-muted">{RESERVE_EVENTS_EMPTY.message}</p>
          <p className="text-xs text-subtle max-w-sm">{RESERVE_EVENTS_EMPTY.detail}</p>
        </div>
      </>
    );
    return bare ? (
      empty
    ) : (
      <div className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col">
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
        <div className="flex items-end justify-between p-5 border-b border-border-subtle">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xs font-bold text-muted uppercase tracking-[0.15em] leading-none">
              {sectionLed ? "Reserve events" : "Contract events"}
            </h2>
            <p className="text-xs text-subtle tracking-wide">
              {sectionLed
                ? `Last ${events.length} reserve events (PTAI)`
                : "Take-profit, curtailment and reserve events"}
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

      <ul aria-label="Recent reserve events" className="flex flex-col">
        {events.map((event) => {
          const eventProvenance = rebalanceProvenance(event.status);
          return (
            <li
              key={event.id}
              className="flex flex-col gap-3 px-5 py-4 border-b border-border-subtle last:border-b-0"
            >
              {/* Top row — rule + status pills, provenance dot */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded border border-[color-mix(in_srgb,var(--ct-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-2 py-0.5 mono text-2xs font-medium text-accent-ink">
                    {event.ruleId}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-2 py-0.5 text-2xs font-bold uppercase tracking-[0.12em]",
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
                  <dd className="text-xs mono text-muted text-right tabular-nums">
                    {dateFmt.format(event.triggeredAt)} UTC
                  </dd>
                </div>
                {event.status === "executed" ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className={microLabel}>Executed</dt>
                    <dd className="text-xs mono text-muted text-right tabular-nums">
                      {dateFmt.format(event.executedAt)} UTC
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <dt className={microLabel}>Trigger summary</dt>
                  <dd className="text-sm text-muted leading-snug line-clamp-2">
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
                        className="inline-flex items-center gap-1 mono text-xs text-muted hover:text-foreground transition-colors"
                        title={event.txHash}
                        aria-label={`View transaction ${event.txHash} on explorer`}
                      >
                        {abbreviateAddress(event.txHash)}
                      </a>
                    ) : (
                      <span className="text-xs text-subtle">Pending execution</span>
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
    <div className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col">
      {inner}
    </div>
  );
}
