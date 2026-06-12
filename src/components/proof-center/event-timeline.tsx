import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
import { EVENT_TIMELINE_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { EventKind, OnChainEvent } from "@/lib/chain/event-logger";
import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";

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

function eventDotClass(kind: EventKind): string {
  if (kind === "GuardrailBreach") return "bg-(--ct-status-danger)";
  if (kind === "Distribution") return "bg-(--ct-status-success)";
  if (kind === "TriggerArmed") return "bg-(--ct-status-warning)";
  return "bg-(--ct-accent)";
}

function EventTimelineItem({
  event,
  showConnector,
}: {
  event: OnChainEvent;
  showConnector: boolean;
}) {
  return (
    <li
      className={cn(
        "relative flex gap-5 pb-8",
        showConnector &&
          "before:absolute before:left-3.25 before:top-7 before:bottom-0 before:w-px before:bg-(--ct-border-soft)",
      )}
    >
      <div className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center">
        <span
          className={cn(
            "h-3 w-3 rounded-full border-2 border-(--ct-surface-2)",
            eventDotClass(event.kind),
          )}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={KIND_VARIANT[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
          <span className="body-xs">Event #{event.eventId.toString()}</span>
        </div>

        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="ct-text-muted">Timestamp</dt>
          <dd className="ct-text-body">{dateFmt.format(event.timestamp)} UTC</dd>

          <dt className="ct-text-muted">Block</dt>
          <dd className="mono tabular ct-text-body">{event.blockNumber.toString()}</dd>

          <dt className="ct-text-muted">Publisher</dt>
          <dd className="mono tabular ct-text-body" title={event.publisher}>
            {abbreviateAddress(event.publisher)}
          </dd>

          <dt className="ct-text-muted">Tx hash</dt>
          <dd className="mono tabular ct-text-primary" title={event.txHash}>
            <a
              href={`${EXPLORER_TX_BASE}${event.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className={explorerLinkClass}
            >
              {abbreviateAddress(event.txHash)}
            </a>
          </dd>

          <dt className="ct-text-muted">Context hash</dt>
          <dd className="mono tabular ct-text-muted" title={event.contextHash}>
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
  );
}

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return <AwaitingMetricState {...EVENT_TIMELINE_EMPTY} />;
  }

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="On-chain event log"
        title={`EventLogger — last ${events.length} events`}
        provenance="live"
        tone="primary"
      />

      <ol className="relative space-y-0" aria-label="On-chain event timeline">
        {events.map((event, idx) => (
          <EventTimelineItem
            key={`${event.eventId.toString()}-${event.txHash}`}
            event={event}
            showConnector={idx < events.length - 1}
          />
        ))}
      </ol>
    </Card>
  );
}
