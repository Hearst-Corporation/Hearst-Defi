import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { EmptySurface } from "@/components/catalyst/empty-surface";
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
  variant?: "product" | "admin";
}

/**
 * Layer-2 drill-down sections shared by product + admin /proof-center/full routes.
 *
 * Every block is a canonical {@link AdminSectionCard} (black uppercase header +
 * flat body) at a SINGLE level — no `BentoPanel`/`ct-glass-panel` wrapper around
 * canon section cards (that produced the cage-in-cage). The Contracts block
 * renders its own canon cards directly (On-chain addresses / Deployed contracts /
 * Audit trail), so they sit as top-level siblings, not nested inside another card.
 */
export function ProofCenterFullSections({
  onChainEvents,
  proofs,
  platformAddresses,
  filter,
  timelockProposals,
  variant = "product",
}: ProofCenterFullSectionsProps) {
  return (
    <div className="flex flex-col gap-y-5">
      <AdminSectionCard
        title={<span id="event-timeline-heading">On-chain event log</span>}
        subtitle="Latest published vault events"
        ariaLabel="On-chain event log"
      >
        <div className="p-5">
          <EventTimeline events={onChainEvents} sectionLed variant={variant} />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title={<span id="proof-grid-heading">Off-chain proofs &amp; documents</span>}
        subtitle="Pinned attestations &amp; signed reports"
        headerTrailing={proofs.length > 0 ? <ProofFilter /> : undefined}
        ariaLabel="Off-chain proofs and documents"
      >
        <div className="p-5">
          {proofs.length === 0 ? (
            <EmptySurface live variant="inline" {...PLATFORM_PROOFS_EMPTY} />
          ) : (
            <ProofGrid proofs={proofs} filter={filter} demo={false} />
          )}
        </div>
      </AdminSectionCard>

      {/* Contracts & review trail — renders its OWN canon cards directly
          (no parent wrapper) so they are top-level siblings, not nested. */}
      <ContractsAuditTrail
        platformAddresses={platformAddresses}
        variant={variant}
      />

      <AdminSectionCard
        title={<span id="timelock-heading">Pending governance timelocks</span>}
        subtitle="Queued actions awaiting execution"
        ariaLabel="Pending governance timelocks"
      >
        <div className="p-5">
          {timelockProposals.length > 0 ? (
            <div className="flex flex-col gap-4">
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
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset px-6 py-10 text-center">
              <div className="ct-bento-label">Governance queue</div>
              <div className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)]">
                No pending timelocks
              </div>
              <p className="max-w-sm text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] leading-relaxed">
                No proposals are currently waiting on a timelock. Queued governance
                actions will appear here before execution.
              </p>
            </div>
          )}
        </div>
      </AdminSectionCard>

      <ProvenanceFooter />
    </div>
  );
}
