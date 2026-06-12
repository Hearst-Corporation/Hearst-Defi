import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { EventKind, OnChainEvent } from "@/lib/chain/event-logger";
import { cn } from "@/lib/cn";
import { abbreviateAddress } from "@/lib/onchain";

interface EventTimelineProps {
  events: ReadonlyArray<OnChainEvent>;
}

const KIND_LABEL: Record<EventKind, string> = {
  Rebalance: "Rebalance",
  Distribution: "Distribution",
  ModeChange: "Mode change",
  GuardrailBreach: "Guardrail breach",
  TriggerArmed: "Trigger armed",
  AttestationPublished: "Attestation published",
};

const KIND_VARIANT: Record<
  EventKind,
  "success" | "brand" | "warning" | "danger" | "default"
> = {
  Rebalance: "brand",
  Distribution: "success",
  ModeChange: "default",
  GuardrailBreach: "danger",
  TriggerArmed: "warning",
  AttestationPublished: "brand",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});


function ipfsGatewayUrl(cid: string): string {
  if (cid.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${cid.slice(7)}`;
  if (cid.startsWith("https://") || cid.startsWith("http://")) return cid;
  return `https://ipfs.io/ipfs/${cid}`;
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <AwaitingMetricState
        message="No on-chain events yet."
        detail="Contracts are live on Base Sepolia — events appear here as the vault operates."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">On-chain event log</span>
          <CardTitle>EventLogger — last {events.length} events</CardTitle>
        </div>
        <ProvenanceBadge kind="attested" />
      </CardHeader>

        <ol className="relative space-y-0" aria-label="On-chain event timeline">
          {events.map((event, idx) => (
            <li
              key={`${event.eventId.toString()}-${event.txHash}`}
              className={cn(
                "relative flex gap-5 pb-8",
                // Suppress timeline line after last item
                idx < events.length - 1 &&
                  "before:absolute before:left-[0.8125rem] before:top-7 before:bottom-0 before:w-px before:bg-[var(--ct-border-soft)]",
              )}
            >
              {/* Timeline dot */}
              <div className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    "h-3 w-3 rounded-full border-2 border-[var(--ct-surface-2)]",
                    event.kind === "GuardrailBreach"
                      ? "bg-[var(--ct-status-danger)]"
                      : event.kind === "Distribution"
                        ? "bg-[var(--ct-status-success)]"
                        : event.kind === "TriggerArmed"
                          ? "bg-[var(--ct-status-warning)]"
                          : "bg-[var(--ct-accent)]",
                  )}
                />
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={KIND_VARIANT[event.kind]}>
                    {KIND_LABEL[event.kind]}
                  </Badge>
                  <span className="body-xs">
                    Event #{event.eventId.toString()}
                  </span>
                </div>

                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                  <dt className="ct-text-muted">Timestamp</dt>
                  <dd className="ct-text-body">
                    {dateFmt.format(event.timestamp)} UTC
                  </dd>

                  <dt className="ct-text-muted">Block</dt>
                  <dd className="mono tabular ct-text-body">
                    {event.blockNumber.toString()}
                  </dd>

                  <dt className="ct-text-muted">Publisher</dt>
                  <dd
                    className="mono tabular ct-text-body"
                    title={event.publisher}
                  >
                    {abbreviateAddress(event.publisher)}
                  </dd>

                  <dt className="ct-text-muted">Tx hash</dt>
                  <dd
                    className="mono tabular ct-text-primary"
                    title={event.txHash}
                  >
                    <a
                      href={`${EXPLORER_TX_BASE}${event.txHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
                    >
                      {abbreviateAddress(event.txHash)}
                    </a>
                  </dd>

                  <dt className="ct-text-muted">Context hash</dt>
                  <dd
                    className="mono tabular ct-text-muted"
                    title={event.contextHash}
                  >
                    {abbreviateAddress(event.contextHash)}
                  </dd>
                </dl>

                {event.payloadCid.length > 0 ? (
                  <div className="mt-1">
                    <Button asChild variant="secondary" size="md">
                      <a
                        href={ipfsGatewayUrl(event.payloadCid)}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        View payload (IPFS)
                      </a>
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
    </Card>
  );
}
