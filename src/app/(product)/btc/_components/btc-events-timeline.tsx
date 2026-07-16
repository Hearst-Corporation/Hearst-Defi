// src/app/(product)/btc/_components/btc-events-timeline.tsx
//
// Dated event timeline (mining settlements, take-profit executions, PoR /
// custody attestations). Distinct from <StepTimeline> (that primitive is for
// static "how it works" step lists, not a dated log) — a small dedicated
// component reusing the same spine/node visual grammar and tokens.

import Link from "next/link";

import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BtcEventType, BtcEventViewModel } from "../_data/btc-page-types";
import { formatIsoDateTime, truncateHash } from "../_data/format-btc";

const TYPE_LABEL: Record<BtcEventType, string> = {
  mining_settlement: "Mining settlement",
  btc_purchase: "BTC purchase",
  take_profit_execution: "Take-profit execution",
  proof_of_reserve: "Proof of reserve",
  custody_attestation: "Custody attestation",
};

export function BtcEventsTimeline({
  events,
}: {
  events: ResolvedViewModel<readonly BtcEventViewModel[]>;
}) {
  if (events.status === "NOT_CONFIGURED" || events.value === null) {
    return (
      <DataNotConfigured
        label="Event timeline"
        detail="This reads from PermissionedDynaVault v2.1, which is not deployed yet."
      />
    );
  }

  if (events.value.length === 0) {
    return (
      <p className="body-sm ct-text-muted">No events recorded yet.</p>
    );
  }

  const list = (
    <ol role="list" className="flex flex-col">
      {events.value.map((event, i) => {
        const isLast = i === events.value!.length - 1;
        return (
          <li key={`${event.type}-${event.occurredAt}-${i}`} className="relative flex gap-[var(--ct-space-4)]">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[var(--ct-space-6)] bottom-0 left-[calc(var(--ct-space-6)/2)] w-px -translate-x-1/2 bg-[var(--ct-border-soft)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-10 mt-[var(--ct-space-1)] flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-[var(--ct-border-accent)] bg-[var(--ct-surface-card)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ct-accent)]" />
            </span>
            <div className="flex min-w-0 flex-col gap-[var(--ct-space-1)] pb-[var(--ct-space-5)]">
              <div className="flex flex-wrap items-baseline gap-[var(--ct-space-2)]">
                <span className="body-sm ct-text-strong font-medium">{TYPE_LABEL[event.type]}</span>
                <span className="ct-metric-caption">{formatIsoDateTime(event.occurredAt)}</span>
              </div>
              <span className="body-sm ct-text-muted">{event.label}</span>
              {event.detail ? (
                <span className="ct-metric-caption">{event.detail}</span>
              ) : null}
              <div className="flex flex-wrap items-center gap-[var(--ct-space-3)]">
                {event.txHash ? (
                  <span className="ct-metric-caption font-mono">{truncateHash(event.txHash)}</span>
                ) : null}
                {event.proofHref ? (
                  <Link
                    href={event.proofHref}
                    className="ct-metric-caption underline underline-offset-2 decoration-[var(--ct-border)] hover:ct-text-primary transition-colors ease-[var(--ct-ease)]"
                  >
                    View proof
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );

  return events.status === "STALE" ? (
    <DataStale label="Event timeline" freshness={events.freshness}>
      {list}
    </DataStale>
  ) : (
    list
  );
}
