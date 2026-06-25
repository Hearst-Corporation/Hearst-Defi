import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { ProofFilter } from "@/components/proof/proof-filter";
import { ProofGrid } from "@/components/proof/proof-grid";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import type { UnifiedProof } from "@/components/proof/proof-types";
import type { FilterValue } from "@/components/proof/proof-filter-types";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import type { OnChainEvent } from "@/lib/chain/event-logger";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";

import type { PlatformAddressEntry } from "./contracts-audit-trail";
import { ContractsAuditTrail } from "./contracts-audit-trail";
import { EventTimeline } from "./event-timeline";
import { ProofCenterCardHeader } from "./proof-center-card-header";
import { ProofCenterSection } from "./proof-center-section";
import { ProvenanceFooter } from "./provenance-footer";

export interface ProofCenterTimelockProposal {
  id: string;
  queuedAt: Date | null;
  createdAt: Date;
  timelockHours: number | null;
}

interface ProofCenterFullSectionsProps {
  onChainEvents: ReadonlyArray<OnChainEvent>;
  proofs: ReadonlyArray<UnifiedProof>;
  platformAddresses: ReadonlyArray<PlatformAddressEntry>;
  filter: FilterValue;
  timelockProposals: ReadonlyArray<ProofCenterTimelockProposal>;
}

/** Layer-2 drill-down sections shared by product + admin /proof-center/full routes. */
export function ProofCenterFullSections({
  onChainEvents,
  proofs,
  platformAddresses,
  filter,
  timelockProposals,
}: ProofCenterFullSectionsProps) {
  return (
    <>
      <ProofCenterSection
        id="event-timeline-heading"
        title="On-chain event log"
      >
        <EventTimeline events={onChainEvents} sectionLed />
      </ProofCenterSection>

      <ProofCenterSection
        id="proof-grid-heading"
        title="Off-chain proofs & documents"
        actions={proofs.length > 0 ? <ProofFilter /> : null}
      >
        {proofs.length === 0 ? (
          <EmptySurface live variant="inline" {...PLATFORM_PROOFS_EMPTY} />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} demo={false} />
        )}
      </ProofCenterSection>

      <ProofCenterSection
        id="contracts-heading"
        title="Contracts & review trail"
      >
        <ContractsAuditTrail platformAddresses={platformAddresses} />
      </ProofCenterSection>

      <ProofCenterSection
        id="timelock-heading"
        title="Pending governance timelocks"
      >
        {timelockProposals.length > 0 ? (
          <div className="product-doc-stack--relaxed">
            {timelockProposals.map((proposal) => (
              <TimelockCountdown
                key={proposal.id}
                proposalId={proposal.id}
                queueTime={(proposal.queuedAt ?? proposal.createdAt).toISOString()}
                delayHours={proposal.timelockHours ?? TIMELOCK_DELAY_HOURS}
              />
            ))}
          </div>
        ) : (
          <Card material="flat" hoverOverlay={false}>
            <ProofCenterCardHeader
              sectionLed
              eyebrow="Governance queue"
              title="No pending timelocks"
              tone="quiet"
            />
            <PanelStatus
              message="No proposals are currently waiting on a timelock."
              detail="Queued governance actions will appear here before execution."
            />
          </Card>
        )}
      </ProofCenterSection>

      <ProvenanceFooter />
    </>
  );
}
