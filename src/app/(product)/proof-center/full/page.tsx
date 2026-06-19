// Proof Center Layer-2 drill-down — unbounded content: on-chain event log,
// off-chain proofs grid, contracts & audit trail, governance timelocks.
// Data is fetched fresh here so the page is standalone (no parent prop-drill).
// The (product) layout already enforces requireInvestor().

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { ProofCenterCardHeader } from "@/components/proof-center/proof-center-card-header";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { ProofCenterTestnetNotice } from "@/components/proof-center/proof-center-testnet-notice";
import { ProvenanceFooter } from "@/components/proof-center/provenance-footer";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";

import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoProofs } from "@/lib/demo/builders";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { prisma } from "@/lib/db";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";

export const metadata = {
  title: "Proof Center — Full log",
  description: "On-chain event log, off-chain proofs, contracts and governance timelocks",
};

interface ProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProofCenterFullPage({
  searchParams,
}: ProofCenterFullPageProps) {
  const chainConfigured = isChainConfigured();
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);

  const [onChainEvents, paper, custody, timelockProposals, showDemoBanner] =
    await Promise.all([
      fetchOnChainEvents({ limit: 100 }),
      demo
        ? Promise.resolve(buildDemoProofs())
        : getProofs().then((r) => r.data),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: { state: "TIMELOCK" },
        orderBy: { queuedAt: "asc" },
      }),
      databaseHasDemoProofs(),
    ]);

  const platformAddresses = buildPlatformAddresses(custody);

  const demoNotice = demo
    ? DEMO_SANDBOX_DISCLAIMER
    : showDemoBanner
      ? "Demo data · Local visual QA — not production"
      : null;

  const proofs: UnifiedProof[] = paper.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return (
    <div className="proof-center-shell">
      <ProofCenterTestnetNotice
        chainConfigured={chainConfigured}
        demoNotice={demoNotice}
      />

      <Link
        href="/proof-center"
        className="inline-flex items-center gap-[var(--ct-space-1_5)] body-sm ct-text-muted no-underline hover:ct-text-primary ct-transition-base self-start"
        aria-label="Back to Proof Center"
      >
        <ArrowLeft className="ct-icon-sm" aria-hidden />
        Proof Center
      </Link>

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
          <ProofGrid proofs={proofs} filter={filter} demo={demo} />
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
