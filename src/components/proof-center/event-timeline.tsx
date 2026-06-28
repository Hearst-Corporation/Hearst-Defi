import type { ReactNode } from "react";

import { EmptySurface } from "@/components/ui/empty-surface";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EVENT_TIMELINE_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { EventKind, OnChainEvent } from "@/lib/chain/event-logger";
import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import { ProofCenterCardHeader } from "./proof-center-card-header";
import type { ProofCenterSectionLedProps } from "./proof-center-types";

interface EventTimelineProps extends ProofCenterSectionLedProps {
  events: ReadonlyArray<OnChainEvent>;
  variant?: "product" | "admin";
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

/**
 * Bento dot tone — accent #A7FB90 for positive on-chain proofs, white tints for
 * neutral/state changes, never any non-canonical green.
 */
function eventDotClass(kind: EventKind): string {
  if (kind === "GuardrailBreach") return "bg-red-400 ring-red-400/15";
  if (kind === "TriggerArmed") return "bg-amber-300 ring-amber-300/15";
  if (kind === "Distribution" || kind === "AttestationPublished") {
    return "bg-[#A7FB90] ring-[#A7FB90]/15";
  }
  if (kind === "ModeChange") return "bg-white/30 ring-white/10";
  return "bg-white/60 ring-white/10";
}

function EventMetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[12px] font-medium tabular-nums text-zinc-300">
        {children}
      </span>
    </div>
  );
}

function EventTimelineItem({
  event,
  showConnector,
}: {
  event: OnChainEvent;
  showConnector: boolean;
}) {
  const payloadHref = ipfsGatewayUrl(event.payloadCid);
  const hasPayload = event.payloadCid.length > 0;

  return (
    <li className="relative flex gap-x-4">
      {/* Dot rail + vertical connector */}
      <div
        className={cn(
          "absolute left-0 top-0 flex w-6 justify-center",
          showConnector ? "-bottom-6" : "h-6",
        )}
      >
        <span aria-hidden="true" className="w-px bg-white/10" />
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-1.5 flex size-2 shrink-0 items-center justify-center rounded-full ring-4 ring-[#111417]",
          eventDotClass(event.kind),
        )}
      />

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={KIND_VARIANT[event.kind]}>{KIND_LABEL[event.kind]}</Badge>
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            Event #{event.eventId.toString()}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-surface-card p-4 shadow-sm">
          <EventMetaRow label="Timestamp">
            {dateFmt.format(event.timestamp)} UTC
          </EventMetaRow>
          <EventMetaRow label="Block">{event.blockNumber.toString()}</EventMetaRow>
          <EventMetaRow label="Publisher">
            <span title={event.publisher}>
              {abbreviateAddress(event.publisher)}
            </span>
          </EventMetaRow>
          <EventMetaRow label="Tx hash">
            <a
              href={`${EXPLORER_TX_BASE}${event.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#A7FB90] no-underline transition-colors hover:underline"
              title={event.txHash}
              aria-label={`View transaction ${event.txHash} on explorer`}
            >
              {abbreviateAddress(event.txHash)}
            </a>
          </EventMetaRow>
          <EventMetaRow label="Context hash">
            <span title={event.contextHash} className="text-zinc-500">
              {abbreviateAddress(event.contextHash)}
            </span>
          </EventMetaRow>
        </div>

        {payloadHref ? (
          <div className="mt-3">
            <a
              href={payloadHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white no-underline transition-colors hover:border-white/20 hover:bg-white/10"
            >
              View payload (IPFS)
            </a>
          </div>
        ) : hasPayload ? (
          <div className="mt-3">
            <span className="text-[12px] font-medium text-zinc-500">
              View payload (IPFS)
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function EventTimeline({
  events,
  sectionLed = false,
  variant = "product",
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

      <ol
        className={cn("relative mt-4", variant === "admin" && "mt-3")}
        aria-label="On-chain event timeline"
      >
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
