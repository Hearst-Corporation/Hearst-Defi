import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
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
        "proof-timeline-item",
        showConnector && "proof-timeline-item--connected",
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

      <div className="min-w-0 flex-1 pf-stack--dense">
        <div className="product-doc-inline-row">
          <Badge variant={KIND_VARIANT[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
          <span className="body-xs">Event #{event.eventId.toString()}</span>
        </div>

        <div className="mt-1 min-w-0">
          <ProofRow label="Timestamp">
            {dateFmt.format(event.timestamp)} UTC
          </ProofRow>
          <ProofRow label="Block">{event.blockNumber.toString()}</ProofRow>
          <ProofRow label="Publisher">
            <span title={event.publisher}>{abbreviateAddress(event.publisher)}</span>
          </ProofRow>
          <ProofRow label="Tx hash">
            <a
              href={`${EXPLORER_TX_BASE}${event.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className={explorerLinkClass}
              title={event.txHash}
            >
              {abbreviateAddress(event.txHash)}
            </a>
          </ProofRow>
          <ProofRow label="Context hash">
            <span className="ct-text-muted" title={event.contextHash}>
              {abbreviateAddress(event.contextHash)}
            </span>
          </ProofRow>
        </div>

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

      <ol className="relative product-doc-stack--flat" aria-label="On-chain event timeline">
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
