// Admin Proof Center — Layer-2 drill-down (full log).
// Unbounded content: on-chain event log, off-chain proofs grid,
// contracts & audit trail, governance timelocks. Data fetched fresh — standalone.

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminLeafLink } from "@/components/admin/dashboard/cockpit-panel-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { Card } from "@/components/ui/card";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { ProofCenterCardHeader } from "@/components/proof-center/proof-center-card-header";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { ProofCenterTestnetNotice } from "@/components/proof-center/proof-center-testnet-notice";
import { ProvenanceFooter } from "@/components/proof-center/provenance-footer";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { prisma } from "@/lib/db";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";

export const metadata = {
  title: "Proof Center — Full log (Admin)",
  description:
    "On-chain event log, off-chain proofs, contracts and audit trail — operator view.",
};

interface AdminProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function AdminProofCenterFullPage({
  searchParams,
}: AdminProofCenterFullPageProps) {
  const chainConfigured = isChainConfigured();
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const [onChainEvents, onChainAttestations, paper, custody, timelockProposals] =
    await Promise.all([
      fetchOnChainEvents({ limit: 100 }),
      fetchOnChainAttestations({ limit: 12 }),
      getProofs().then((r) => r.data),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: { state: "TIMELOCK" },
        orderBy: { queuedAt: "asc" },
      }),
    ]);

  const platformAddresses = buildPlatformAddresses(custody);

  const proofs: UnifiedProof[] = paper.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return (
    <div className="proof-center-shell admin-doc-shell">
      <ProofCenterTestnetNotice chainConfigured={chainConfigured} />

      <AdminPageHeader
        title="Proof Center — Full log"
        description="On-chain event log, off-chain proofs, contracts and audit trail."
        lead={
          <Link
            href="/admin/proof-center"
            className="inline-flex items-center gap-[var(--ct-space-1_5)] body-sm ct-text-muted no-underline hover:ct-text-primary ct-transition-base self-start mb-[var(--ct-space-2)]"
            aria-label="Back to Proof Center hub"
          >
            <ArrowLeft className="ct-icon-sm" aria-hidden />
            Proof Center
          </Link>
        }
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <AdminLeafLink href="/admin/proofs" label="Gérer les publications" />
            <ChainStatusBadge
              configured={chainConfigured}
              eventCount={onChainEvents.length}
              attestationCount={onChainAttestations.length}
            />
          </div>
        }
      />

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
          <EmptySurface live {...PLATFORM_PROOFS_EMPTY} />
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
          <Card hoverOverlay={false}>
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
    </div>
  );
}
