// Series1ProofEventStepper — the canonical evidence stepper for indexed
// Series 1 events (Decision 007: neither StepTimeline nor ConstructionStepper
// reused as-is; this is a new component that borrows EventTimeline's
// open-log shape and ConstructionStepper's node/connector visual grammar,
// sourced from `Series1EventSummary` alone).
//
// Doctrine §9 requires five elements per step: icon, label, status,
// description, connector. Every node here carries all five — the status is
// always "indexed" (an event in this list has already been proved on-chain;
// there is no "pending" for a real event, see series1-event-stepper.ts).

import { cn } from "@/lib/cn";
import { Series1Panel, Series1PanelHeader } from "@/components/series1-shell/Series1Panel";
import { Series1ProvenanceTag } from "@/components/series1-shell/Series1ChartPlaceholder";

import type {
  Series1ProofEventNodeModel,
  Series1ProofNetworkKind,
  Series1ProofStepperState,
} from "@/lib/proof-center/series1-event-stepper";

const CHECK = (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function NetworkBadge({ networkKind, label }: { networkKind: Series1ProofNetworkKind; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold tracking-[0.06em] uppercase",
        networkKind === "network_mismatch"
          ? "text-warning ring-1 ring-warning"
          : "text-muted ring-1 ring-border-subtle",
      )}
    >
      {label}
    </span>
  );
}

function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Series1ProofEventDetail({ event }: { event: Series1ProofEventNodeModel }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-2xs leading-5 sm:grid-cols-3">
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Block</dt>
        <dd className="mono tabular text-muted">{event.blockNumber}</dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Log index</dt>
        <dd className="mono tabular text-muted">{event.logIndex}</dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Tx hash</dt>
        <dd className="mono text-muted" title={event.txHash}>
          {shortHash(event.txHash)}
        </dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Occurred at</dt>
        <dd className="mono tabular text-muted">
          {event.occurredAt ?? "Not reported"}
        </dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Indexed at</dt>
        <dd className="mono tabular text-muted" title="Technical indexing time — not the on-chain event time">
          {event.indexedAt}
        </dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Chain</dt>
        <dd className="mono tabular text-muted">{event.chainId}</dd>
      </div>
      <div>
        <dt className="text-subtle uppercase tracking-[0.08em]">Contract</dt>
        <dd className="mono text-muted" title={event.contractAddress}>
          {shortAddress(event.contractAddress)}
        </dd>
      </div>
      {event.investorAddress ? (
        <div>
          <dt className="text-subtle uppercase tracking-[0.08em]">Investor</dt>
          <dd className="mono text-muted" title={event.investorAddress}>
            {shortAddress(event.investorAddress)}
          </dd>
        </div>
      ) : null}
      {event.assetAmountAtomic ? (
        <div>
          <dt className="text-subtle uppercase tracking-[0.08em]">Asset amount</dt>
          <dd className="mono tabular text-muted">{event.assetAmountAtomic}</dd>
        </div>
      ) : null}
      {event.shareAmountAtomic ? (
        <div>
          <dt className="text-subtle uppercase tracking-[0.08em]">Share amount</dt>
          <dd className="mono tabular text-muted">{event.shareAmountAtomic}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function Series1ProofEventNode({
  event,
  isLast,
}: {
  event: Series1ProofEventNodeModel;
  isLast: boolean;
}) {
  return (
    <li className={cn("relative flex gap-4", !isLast && "pb-6")}>
      <div className="flex flex-col items-center">
        {/* Node — icon + status, always "indexed" (accent, checked) for a real event. */}
        <span
          role="img"
          aria-label="indexed"
          className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-background"
        >
          {CHECK}
        </span>
        {/* Connector — continuous rail to the next node. */}
        {!isLast ? <span aria-hidden className="my-1 w-px flex-1 bg-accent" /> : null}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{event.displayLabel}</p>
          <span className="mono text-2xs text-subtle">{event.eventName}</span>
          {!event.isKnownEventType ? (
            <span className="rounded-full px-2 py-0.5 text-2xs font-semibold text-muted uppercase ring-1 ring-border-subtle">
              Uncatalogued type
            </span>
          ) : null}
          <NetworkBadge networkKind={event.provenance.networkKind} label={event.provenance.label} />
        </div>
        <p className="mt-0.5 text-xs leading-5 text-muted">{event.description}</p>
        <Series1ProofEventDetail event={event} />
      </div>
    </li>
  );
}

export function Series1ProofEventEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-center py-8 px-5 bg-surface-card border border-border-subtle rounded-xl min-h-32">
      <p className="text-sm font-medium text-foreground">No events indexed yet.</p>
      <p className="max-w-sm text-xs leading-5 text-muted">
        The indexer has not recorded a Series 1 event yet. This is a genuinely empty ledger, not an outage.
      </p>
    </div>
  );
}

export function Series1ProofEventUnavailable({ detail }: { detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-center py-8 px-5 bg-surface-card border border-border-subtle rounded-xl min-h-32">
      <p className="text-sm font-medium text-foreground">Indexer unreachable.</p>
      <p className="max-w-sm text-xs leading-5 text-muted">
        This is an outage of the read, not a statement that no event exists.
        {detail ? ` (${detail})` : ""}
      </p>
    </div>
  );
}

function Series1ProofEventNotConfigured({ reason }: { reason: "simulated_rejected" | "not_configured" }) {
  const message =
    reason === "simulated_rejected"
      ? "Preview / simulated data is not accepted as proof."
      : "No indexer configured for this deployment yet.";
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-center py-8 px-5 bg-surface-card border border-border-subtle rounded-xl min-h-32">
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="max-w-sm text-xs leading-5 text-muted">
        {reason === "simulated_rejected"
          ? "A simulated read was returned by the backend. Simulated data is never rendered as investor-facing proof."
          : "Figures resolve once the indexer is deployed and reporting."}
      </p>
    </div>
  );
}

export function Series1ProofEventStepper({ state }: { state: Series1ProofStepperState }) {
  return (
    <Series1Panel>
      <Series1PanelHeader
        title="Proof event stepper"
        description="Real indexed events, ordered by block number — not a storytelling sequence."
        actions={
          state.envelopeStatus === "live" ? (
            <Series1ProvenanceTag status="live" />
          ) : state.envelopeStatus === "unavailable" || state.envelopeStatus === "error" ? (
            <Series1ProvenanceTag status="unavailable" />
          ) : null
        }
      />
      <div className="px-5 py-5">
        {state.envelopeStatus === "live" ? (
          <ol className="flex flex-col" aria-label="Indexed Series 1 events">
            {state.events.map((event, i) => (
              <Series1ProofEventNode key={event.id} event={event} isLast={i === state.events.length - 1} />
            ))}
          </ol>
        ) : state.envelopeStatus === "empty" ? (
          <Series1ProofEventEmptyState />
        ) : state.envelopeStatus === "not_configured" ? (
          <Series1ProofEventNotConfigured reason={state.notConfiguredReason ?? "not_configured"} />
        ) : state.envelopeStatus === "unavailable" ? (
          <Series1ProofEventUnavailable />
        ) : (
          <Series1ProofEventUnavailable detail={state.errorDetail} />
        )}
      </div>
    </Series1Panel>
  );
}
