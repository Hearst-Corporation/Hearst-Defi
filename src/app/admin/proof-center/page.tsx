// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth + DemoDataBanner.

export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminCockpitPanelHeader,
  AdminLeafLink,
} from "@/components/admin/dashboard/cockpit-panel-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofCenterColdShell } from "@/components/proof-center/proof-center-cold-shell";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { ProofCenterTestnetNotice } from "@/components/proof-center/proof-center-testnet-notice";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { RebalancingEventsPanel } from "@/components/proof-center/rebalancing-events-panel";
import { PorSummary } from "@/components/proof-center/por-summary";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/cn";

export default async function AdminProofCenterPage() {
  await requireAdmin();

  const chainConfigured = isChainConfigured();
  const coveragePeriod = new Date().toISOString().slice(0, 7);

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
    getProofs().then((r) => r.data),
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
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  const platformAddresses = buildPlatformAddresses(custody);

  const coldEmpty = isProofCenterColdEmpty({
    demo: showDemoBanner,
    hasAttestation: latestAttestation !== null,
    proofsCount: paper.length,
    onChainEventsCount: onChainEvents.length,
    distributionsCount: recentDistributions.length,
    rebalancesCount: recentRebalances.length,
    timelockCount: timelockProposals.length,
  });

  return (
    <div
      className={cn(
        "proof-center-shell",
        !coldEmpty && "proof-cockpit proof-cockpit--fit",
      )}
    >
      <ProofCenterTestnetNotice chainConfigured={chainConfigured} />

      <AdminPageHeader
        title="Proof Center"
        description="Reserve attestations, cash-flow evidence, distributions and rebalancing — operator hub."
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={onChainAttestations.length}
          />
        }
      />

      {showDemoBanner ? <DemoDataBanner /> : null}

      {coldEmpty ? (
        <>
          <ProofCenterColdShell chainConfigured={chainConfigured} />
          <ProofCenterSection
            id="contracts-heading"
            title="Contracts & review trail"
          >
            <ContractsAuditTrail platformAddresses={platformAddresses} />
          </ProofCenterSection>
        </>
      ) : (
        <>
          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Proof of Reserves"
                  trailing={
                    <AdminLeafLink
                      href="/admin/proof-center/full"
                      label="View full"
                    />
                  }
                />
                <div className="proof-panel-scroll">
                  <PorSummary
                    attestation={latestAttestation}
                    custody={custody}
                    verified={latestAttestationVerified}
                    demo={showDemoBanner}
                    sectionLed={false}
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader title="Mining cash-flow evidence" />
                <div className="proof-panel-scroll">
                  <MiningCashFlowEvidence coverage={coverage} sectionLed={false} />
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Latest distributions"
                  trailing={
                    <AdminLeafLink href="/admin/proof-center/full" label="View full" />
                  }
                />
                <div className="proof-panel-scroll">
                  {recentDistributions.length === 0 ? (
                    <EmptySurface
                      message="No distributions yet"
                      detail="USDC payouts will appear once the vault operates."
                    />
                  ) : (
                    <RecentDistributions
                      distributions={recentDistributions}
                      sectionLed={false}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Rebalancing events"
                  trailing={
                    <AdminLeafLink href="/admin/proof-center/full" label="View full" />
                  }
                />
                <div className="proof-panel-scroll">
                  {recentRebalances.length === 0 ? (
                    <EmptySurface
                      message="No rebalancing events yet"
                      detail="Rebalancing activity will appear once the vault operates."
                    />
                  ) : (
                    <RebalancingEventsPanel
                      events={recentRebalances}
                      sectionLed={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
