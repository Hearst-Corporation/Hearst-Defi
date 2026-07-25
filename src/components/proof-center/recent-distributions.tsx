import type { ReactNode } from "react";

import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DELIVERY_EVENTS_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE, isPlaceholderTxHash } from "@/lib/chain/client";
import type { ProofCenterDistributionRow } from "@/lib/data/proof-center";
import { distributionProvenance } from "@/lib/proof-center/distribution-provenance";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import type { Provenance } from "@/components/ui/provenance-badge";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import type { ProofCenterSectionLedProps } from "./proof-center-types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

// Strongest → weakest. Panel badge takes the weakest row so it never overstates.
const PROVENANCE_RANK: Record<Provenance, number> = {
  live: 0,
  oracle: 1,
  attested: 2,
  estimated: 3,
  partial: 4,
  manual: 5,
  stale: 6,
  simulated: 7,
};

export function weakestProvenance(kinds: readonly Provenance[]): Provenance {
  return kinds.reduce((weakest, kind) =>
    PROVENANCE_RANK[kind] > PROVENANCE_RANK[weakest] ? kind : weakest,
  );
}

/** Micro label — Portfolio/vaults bento style. */
function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <span className="ct-bento-label">
      {children}
    </span>
  );
}

interface DeliveryEventsProps extends ProofCenterSectionLedProps {
  events: ReadonlyArray<ProofCenterDistributionRow>;
}

export function DeliveryEvents({
  events,
  sectionLed = false,
  bare = false,
}: DeliveryEventsProps) {
  if (events.length === 0) {
    const empty = (
      <>
        {!bare && (
          <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1.5">
              <MicroLabel>Delivery evidence</MicroLabel>
              <h3 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
                Awaiting first delivery event
              </h3>
            </div>
          </div>
        )}
        <EmptySurface {...DELIVERY_EVENTS_EMPTY} />
      </>
    );
    return bare ? (
      empty
    ) : (
      <section className="dark rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
        {empty}
      </section>
    );
  }

  const panelProvenance = weakestProvenance(
    events.map((event) => distributionProvenance(event.txHash)),
  );

  const inner = (
    <>
      {!bare && (
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-1.5">
            <MicroLabel>
              {sectionLed ? "Delivery evidence" : "Maturity settlement"}
            </MicroLabel>
            <h3 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
              {sectionLed
                ? `Last ${events.length} delivery events`
                : "On-chain delivery events"}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <ProvenanceBadge kind={panelProvenance} variant="compact" />
          </div>
        </div>
      )}

      <ul
        className="flex flex-col px-5"
        aria-label="Recent on-chain delivery events"
      >
        {events.map((event) => {
          const provenance = distributionProvenance(event.txHash);
          return (
            <li
              key={event.id}
              className="flex flex-col gap-2.5 py-4 border-b border-[var(--ct-border-soft)] last:border-b-0"
            >
              {/* Period + amount headline row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)]">
                    Event period {event.period}
                  </span>
                  <ProvenanceBadge variant="strip" kind={provenance} />
                </div>
                <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] tabular-nums">
                  {formatUsdCompact(event.amountUsdc)}
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <MicroLabel>Recipients</MicroLabel>
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] tabular-nums">
                    {event.recipientsCount.toString()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <MicroLabel>Settled</MicroLabel>
                  <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] tabular-nums">
                    {dateFmt.format(event.distributedAt)} UTC
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <MicroLabel>Tx hash</MicroLabel>
                  {event.txHash && !isPlaceholderTxHash(event.txHash) ? (
                    <a
                      href={`${EXPLORER_TX_BASE}${event.txHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={cn(
                        "inline-flex items-center gap-1 text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] transition-colors duration-150 hover:text-[color-mix(in_srgb,var(--ct-accent)_80%,transparent)]",
                      )}
                      title={event.txHash}
                      aria-label={`View transaction ${event.txHash} on explorer`}
                    >
                      <span className="truncate">{abbreviateAddress(event.txHash)}</span>
                    </a>
                  ) : event.txHash ? (
                    <span className="truncate text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
                      Simulated (testnet fixture)
                    </span>
                  ) : (
                    <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">Pending broadcast</span>
                  )}
                </div>
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
    <section className="dark rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
      {inner}
    </section>
  );
}
