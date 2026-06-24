import { EmptySurface } from "@/components/ui/empty-surface";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { REBALANCING_EVENTS_EMPTY } from "@/components/proof/empty-messages";
import { RebalancePtaiModalTrigger } from "@/components/proof-center/rebalance-ptai-modal-trigger";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofCenterRebalanceRow } from "@/lib/data/proof-center";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";

import { ProofCenterCardHeader } from "./proof-center-card-header";
import type { ProofCenterSectionLedProps } from "./proof-center-types";
import { cleanRebalanceTriggerText } from "./formatters";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function statusVariant(
  status: string,
): "default" | "success" | "warning" | "danger" | "brand" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "brand";
    case "executed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

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

interface RebalancingEventsPanelProps extends ProofCenterSectionLedProps {
  events: ReadonlyArray<ProofCenterRebalanceRow>;
}

export function RebalancingEventsPanel({
  events,
  sectionLed = false,
}: RebalancingEventsPanelProps) {
  if (events.length === 0) {
    return (
      <Card material="flat" hoverOverlay={false}>
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow="Rebalancing events"
          title="Awaiting first rebalance"
          tone="quiet"
        />
        <EmptySurface live {...REBALANCING_EVENTS_EMPTY} />
      </Card>
    );
  }

  const panelProvenance = weakestRebalanceProvenance(
    events.map((event) => rebalanceProvenance(event.status)),
  );

  return (
    <Card material="flat">
      <ProofCenterCardHeader
        sectionLed={sectionLed}
        eyebrow={sectionLed ? "Rebalancing events" : "Vault operations"}
        title={sectionLed ? `Last ${events.length} rule-triggered events (PTAI)` : "Rule-triggered events"}
        provenance={panelProvenance}
        tone={sectionLed ? "primary" : "quiet"}
      />

      <ul className="divide-y divide-(--ct-border-soft)" aria-label="Recent rebalancing events">
        {events.map((event) => (
          <li
            key={event.id}
            className="product-doc-section__head proof-list-row"
          >
            <div className="min-w-0 flex-1 product-doc-stack product-doc-stack--compact">
              <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--wrap">
                <div className="product-doc-inline-row">
                  <Badge variant="accent" className="mono body-xs">
                    {event.ruleId}
                  </Badge>
                  <Badge variant={statusVariant(event.status)}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </Badge>
                </div>
                <ProvenanceBadge
                  variant="strip"
                  kind={rebalanceProvenance(event.status)}
                />
              </div>

              <div className="proof-row-meta min-w-0">
                <ProofRow label="Triggered">
                  {dateFmt.format(event.triggeredAt)} UTC
                </ProofRow>
                {event.status === "executed" ? (
                  <ProofRow label="Executed">
                    {dateFmt.format(event.executedAt)} UTC
                  </ProofRow>
                ) : null}
                <ProofRow label="Trigger summary">
                  <span className="line-clamp-2">
                    {cleanRebalanceTriggerText(event.triggerText)}
                  </span>
                </ProofRow>
                {event.txHash ? (
                  <ProofRow label="Tx hash">
                    <a
                      href={`${EXPLORER_TX_BASE}${event.txHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={cn(explorerLinkClass, "inline-flex items-center gap-1")}
                      title={event.txHash}
                      aria-label={`View transaction ${event.txHash} on explorer`}
                    >
                      <span className="ct-proof-row__truncate">
                        {abbreviateAddress(event.txHash)}
                      </span>
                    </a>
                  </ProofRow>
                ) : (
                  <ProofRow label="Tx hash">
                    <span className="ct-text-muted">Pending execution</span>
                  </ProofRow>
                )}
              </div>

              <div className="proof-row-action">
                <RebalancePtaiModalTrigger event={event} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
