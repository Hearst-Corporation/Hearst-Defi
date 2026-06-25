import { EmptySurface } from "@/components/ui/empty-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { EVENT_TIMELINE_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { EventKind, OnChainEvent } from "@/lib/chain/event-logger";
import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";

import { ProofCenterCardHeader } from "./proof-center-card-header";
import type { ProofCenterSectionLedProps } from "./proof-center-types";

interface EventTimelineProps extends ProofCenterSectionLedProps {
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

function eventTimelineCardTitle(
  eventCount: number,
  sectionLed: boolean,
): string {
  if (eventCount === 0) {
    return sectionLed
      ? "Awaiting first events"
      : "On-chain event log — awaiting first events";
  }
  return sectionLed
    ? `Last ${eventCount} events`
    : `On-chain event log — last ${eventCount} events`;
}

function eventDotClass(kind: EventKind): string {
  if (kind === "GuardrailBreach") return "proof-dot--danger";
  if (kind === "Distribution") return "proof-dot--success";
  if (kind === "TriggerArmed") return "proof-dot--warning";
  if (kind === "AttestationPublished") return "proof-dot--success";
  if (kind === "ModeChange") return "proof-dot--neutral";
  return "proof-dot--info";
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
      <div className="proof-timeline-dot-rail">
        <span
          className={cn("proof-dot", eventDotClass(event.kind))}
        />
      </div>

      <div className="min-w-0 flex-1 product-doc-stack product-doc-stack--compact">
        <div className="product-doc-inline-row">
          <Badge variant={KIND_VARIANT[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
          <span className="body-xs">Event #{event.eventId.toString()}</span>
        </div>

        <div className="proof-timeline-meta min-w-0">
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

        {(() => {
          const href = ipfsGatewayUrl(event.payloadCid);
          if (href) {
            return (
              <div className="proof-timeline-action">
                <Button asChild variant="secondary" size="md">
                  <a href={href} target="_blank" rel="noreferrer noopener">
                    View payload (IPFS)
                  </a>
                </Button>
              </div>
            );
          }
          if (event.payloadCid.length > 0) {
            return (
              <div className="proof-timeline-action">
                <span className="ct-text-muted body-sm">View payload (IPFS)</span>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </li>
  );
}

export function EventTimeline({
  events,
  sectionLed = false,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <Card material="flat" hoverOverlay={false}>
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow="On-chain event log"
          title={eventTimelineCardTitle(0, sectionLed)}
          tone="quiet"
        />
        <EmptySurface live {...EVENT_TIMELINE_EMPTY} />
      </Card>
    );
  }

  const eventsProvenance = "live" as const;

  return (
    <Card material="flat">
      <ProofCenterCardHeader
        sectionLed={sectionLed}
        eyebrow="On-chain event log"
        title={eventTimelineCardTitle(events.length, sectionLed)}
        provenance={eventsProvenance}
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
