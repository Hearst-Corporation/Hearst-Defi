import type { ReactNode } from "react";

import { EmptySurface } from "@/components/ui/empty-surface";
import { ProofFilter } from "@/components/proof/proof-filter";
import { ProofGrid } from "@/components/proof/proof-grid";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import type { UnifiedProof } from "@/components/proof/proof-types";
import type { FilterValue } from "@/components/proof/proof-filter-types";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import type { OnChainEvent } from "@/lib/chain/event-logger";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";
import { cn } from "@/lib/cn";

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
 * Bento section wrapper — pure Tailwind, matches the Portfolio page + the
 * converted vault flow. Keeps the visible page `<h2>` so existing
 * `aria-labelledby` wiring and section ordering stay intact across the
 * product + admin /proof-center/full routes.
 */
function BentoSection({
  id,
  title,
  subtitle,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 border-b border-white/5">
        <div className="flex flex-col gap-1.5">
          <h2
            id={id}
            className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none m-0"
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="text-[12px] text-zinc-500 tracking-wide">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pb-0.5">{actions}</div>
        ) : null}
      </div>
      <div className="p-5 lg:p-6">{children}</div>
    </section>
  );
}

/** Layer-2 drill-down sections shared by product + admin /proof-center/full routes. */
export function ProofCenterFullSections({
  onChainEvents,
  proofs,
  platformAddresses,
  filter,
  timelockProposals,
  variant = "product",
}: ProofCenterFullSectionsProps) {
  const admin = variant === "admin";

  return (
    <div className="dark flex flex-col gap-y-5">
      <BentoSection
        id="event-timeline-heading"
        title="On-chain event log"
        subtitle="Latest published vault events"
      >
        <EventTimeline events={onChainEvents} sectionLed variant={variant} />
      </BentoSection>

      <BentoSection
        id="proof-grid-heading"
        title="Off-chain proofs & documents"
        subtitle="Pinned attestations & signed reports"
        actions={proofs.length > 0 ? <ProofFilter /> : null}
      >
        {proofs.length === 0 ? (
          <EmptySurface live variant="inline" {...PLATFORM_PROOFS_EMPTY} />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} demo={false} />
        )}
      </BentoSection>

      <BentoSection
        id="contracts-heading"
        title="Contracts & review trail"
        subtitle="Deployed addresses & audit history"
      >
        <ContractsAuditTrail platformAddresses={platformAddresses} variant={variant} />
      </BentoSection>

      <BentoSection
        id="timelock-heading"
        title="Pending governance timelocks"
        subtitle="Queued actions awaiting execution"
      >
        {timelockProposals.length > 0 ? (
          <div
            className={cn(
              "flex flex-col",
              admin ? "gap-4" : "gap-5",
            )}
          >
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
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#15191C] px-6 py-10 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Governance queue
            </div>
            <div className="text-[15px] font-medium text-white">
              No pending timelocks
            </div>
            <p className="max-w-sm text-[12px] text-zinc-500 leading-relaxed">
              No proposals are currently waiting on a timelock. Queued governance
              actions will appear here before execution.
            </p>
          </div>
        )}
      </BentoSection>

      <ProvenanceFooter />
    </div>
  );
}
