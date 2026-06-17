// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// This is a standalone page; it does NOT re-export the admin version.

export const dynamic = "force-dynamic";

import { TriangleAlert } from "lucide-react";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { PanelStatus } from "@/components/ui/panel-status";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";
import { ProofCenterCardHeader } from "@/components/proof-center/proof-center-card-header";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { RebalancingEventsPanel } from "@/components/proof-center/rebalancing-events-panel";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { TimelockCountdown } from "@/components/governance/timelock-countdown";
import {
  isChainConfigured,
} from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { loadCustody } from "@/lib/data/custody";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoProofs } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { prisma } from "@/lib/db";
import { TIMELOCK_DELAY_HOURS } from "@/lib/governance/state-machine";

interface ProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProductProofCenterPage({
  searchParams,
}: ProofCenterPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const chainConfigured = isChainConfigured();

  // Demo provider (guard-gated → never production): the recognized demo
  // identity sees synthetic demo proofs in the grid instead of the DB rows.
  // The on-chain sections (events / attestations / custody / coverage) are
  // untouched and keep their normal testnet/empty states.
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);

  const coveragePeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [
    onChainEvents,
    onChainAttestations,
    paper,
    custody,
    timelockProposals,
    showDemoBanner,
    coverage,
    recentDistributions,
    recentRebalances,
  ] = await Promise.all([
    fetchOnChainEvents({ limit: 20 }),
    fetchOnChainAttestations({ limit: 12 }),
    demo
      ? Promise.resolve(buildDemoProofs())
      : getProofs().then((r) => r.data),
    loadCustody(),
    prisma.governanceProposal.findMany({
      where: { state: "TIMELOCK" },
      orderBy: { queuedAt: "asc" },
    }),
    databaseHasDemoProofs(),
    loadCoverageForVault(PROOF_CENTER_VAULT_REF, coveragePeriod),
    loadRecentDistributions(PROOF_CENTER_VAULT_REF, 6),
    loadRecentRebalances(PROOF_CENTER_VAULT_REF, 5),
  ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  // A4 — "Attested" badge requires a fresh attestation AND an allowlisted signer.
  // Mirrors the same computation used by the admin proof-center. Fail-closed when
  // there is no attestation or no allowlist configured.
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  // P1 — live distribution coverage for the Yield vault, current calendar month.
  const platformAddresses = buildPlatformAddresses(custody);

  // Proof catalog — off-chain documents only
  const proofs: UnifiedProof[] = paper.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  const demoNotice = demo
    ? DEMO_SANDBOX_DISCLAIMER
    : showDemoBanner
      ? "Demo data · Local visual QA — not production"
      : null;
  const showNotices = chainConfigured || demoNotice !== null;

  return (
    <div className="proof-center-shell">
      {showNotices ? (
        <div
          role="note"
          aria-label="Proof Center notices"
          className="product-doc-callout"
        >
          {chainConfigured ? (
            <TriangleAlert
              className="ct-icon-sm ct-icon-sm--offset-top ct-status-warning"
              aria-hidden
            />
          ) : null}
          <div className="product-doc-stack product-doc-stack--tight min-w-0">
            {chainConfigured ? (
              <p className="body-sm ct-text-strong m-0">
                On-chain proofs are read from a{" "}
                <strong>test network</strong> — not production mainnet.
                Addresses, balances, and attestations shown here are test
                artefacts.
              </p>
            ) : null}
            {demoNotice ? (
              <p className="body-sm ct-status-warning m-0 font-medium">
                {demoNotice}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <ProductPageHeader
        eyebrow="Hearst Yield Vault"
        title="Proof Center"
        description={
          <>
            Every data point that backs the vault — mining attestations, custody
            snapshots, audits, and the methodology itself — hashed and posted
            with its source URI.
          </>
        }
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={onChainAttestations.length}
          />
        }
      />

      <ProofCenterSection id="por-heading" title="Proof of Reserves">
        <PorSummary
          attestation={latestAttestation}
          custody={custody}
          verified={latestAttestationVerified}
          demo={demo}
          sectionLed
        />
      </ProofCenterSection>

      <ProofCenterSection
        id="cashflow-heading"
        title="Mining cash-flow evidence"
      >
        <MiningCashFlowEvidence coverage={coverage} sectionLed />
      </ProofCenterSection>

      <ProofCenterSection id="distributions-heading" title="Latest distributions">
        <RecentDistributions distributions={recentDistributions} sectionLed />
      </ProofCenterSection>

      <ProofCenterSection id="rebalance-heading" title="Rebalancing events">
        <RebalancingEventsPanel events={recentRebalances} sectionLed />
      </ProofCenterSection>

      <ProofCenterSection id="event-timeline-heading" title="On-chain event log">
        <EventTimeline events={onChainEvents} sectionLed />
      </ProofCenterSection>

      <ProofCenterSection
        id="proof-grid-heading"
        title="Off-chain proofs & documents"
        actions={proofs.length > 0 ? <ProofFilter /> : null}
      >
        {proofs.length === 0 ? (
          <AwaitingMetricState {...PLATFORM_PROOFS_EMPTY} />
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

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="proof-center-footer">
        <DashboardPanelHeader
          eyebrow="Read path"
          title="Data provenance"
          tone="quiet"
        />
        <p className="body-xs ct-prose-md ct-text-muted">
          {chainConfigured ? (
            <>
              On-chain entries are read from a test network — not production
              mainnet. Contract addresses, tx links, and attestation context
              are exposed in the modules above. Off-chain entries are pinned
              to IPFS or signed HTTPS endpoints. On-chain data and vault state
              are fetched fresh on every request.
            </>
          ) : (
            <>
              Off-chain entries are pinned to IPFS or signed HTTPS endpoints. On-chain
              attestation will be enabled following mainnet deployment. Vault state is
              fetched fresh on every request.
            </>
          )}
        </p>
      </footer>
    </div>
  );
}
