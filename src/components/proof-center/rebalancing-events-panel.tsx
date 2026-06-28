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
// (#A7FB90); never a warning/danger colour for benign rebalance states.
const PROVENANCE_LABEL: Record<RebalanceProvenance, string> = {
  live: "Live",
  manual: "Manual",
  stale: "Stale",
};

const PROVENANCE_DOT: Record<RebalanceProvenance, string> = {
  live: "bg-[#A7FB90]",
  manual: "bg-zinc-500",
  stale: "bg-zinc-600",
};

// Status pill — accent for the executed (terminal/healthy) state, quiet zinc
// chrome otherwise. No green other than #A7FB90.
const STATUS_PILL: Record<string, string> = {
  executed: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
  approved: "border-white/10 bg-white/5 text-zinc-300",
  pending: "border-white/10 bg-white/5 text-zinc-400",
  cancelled: "border-white/10 bg-white/5 text-zinc-500",
};

function statusPillClass(status: string): string {
  return STATUS_PILL[status] ?? "border-white/10 bg-white/5 text-zinc-400";
}

const microLabel = "text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500";

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
          <div className="flex items-end justify-between p-5 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
                Rebalancing events
              </h2>
              <p className="text-[12px] text-zinc-500 tracking-wide">Awaiting first rebalance</p>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="text-[13px] font-medium text-zinc-300">{REBALANCING_EVENTS_EMPTY.message}</p>
          <p className="text-[12px] text-zinc-500 max-w-sm">{REBALANCING_EVENTS_EMPTY.detail}</p>
        </div>
      </>
    );
    return bare ? (
      empty
    ) : (
      <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
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
        <div className="flex items-end justify-between p-5 border-b border-white/5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
              {sectionLed ? "Rebalancing events" : "Vault operations"}
            </h2>
            <p className="text-[12px] text-zinc-500 tracking-wide">
              {sectionLed
                ? `Last ${events.length} rule-triggered events (PTAI)`
                : "Rule-triggered events"}
            </p>
          </div>
          <span
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500"
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
              className="flex flex-col gap-3 px-5 py-4 border-b border-white/5 last:border-b-0"
            >
              {/* Top row — rule + status pills, provenance dot */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded border border-[#A7FB90]/25 bg-[#A7FB90]/10 px-2 py-0.5 font-mono text-[11px] font-medium text-[#A7FB90]">
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
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 shrink-0"
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
                  <dd className="text-[12px] font-mono text-zinc-300 text-right tabular-nums">
                    {dateFmt.format(event.triggeredAt)} UTC
                  </dd>
                </div>
                {event.status === "executed" ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className={microLabel}>Executed</dt>
                    <dd className="text-[12px] font-mono text-zinc-300 text-right tabular-nums">
                      {dateFmt.format(event.executedAt)} UTC
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <dt className={microLabel}>Trigger summary</dt>
                  <dd className="text-[13px] text-zinc-300 leading-snug line-clamp-2">
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
                        className="inline-flex items-center gap-1 font-mono text-[12px] text-zinc-400 hover:text-white transition-colors"
                        title={event.txHash}
                        aria-label={`View transaction ${event.txHash} on explorer`}
                      >
                        {abbreviateAddress(event.txHash)}
                      </a>
                    ) : (
                      <span className="text-[12px] text-zinc-500">Pending execution</span>
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
    <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
      {inner}
    </div>
  );
}
