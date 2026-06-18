// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// Layer-1 fit bento hub: bounded widgets (PoR, cash-flow, distributions, rebalances).
// Unbounded content (event log, proofs grid, contracts, timelocks) → /proof-center/full

export const dynamic = "force-dynamic";

import { TriangleAlert } from "lucide-react";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofCenterColdShell } from "@/components/proof-center/proof-center-cold-shell";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { RebalancingEventsPanel } from "@/components/proof-center/rebalancing-events-panel";
import { PorSummary } from "@/components/proof-center/por-summary";
import {
  AdminCockpitPanelHeader,
  AdminLeafLink,
} from "@/components/admin/dashboard/cockpit-panel-header";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import {
  isChainConfigured,
} from "@/lib/chain/client";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { loadCustody } from "@/lib/data/custody";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoProofs } from "@/lib/demo/builders";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { prisma } from "@/lib/db";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { cn } from "@/lib/cn";

interface ProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProductProofCenterPage({
  searchParams: _searchParams,
}: ProofCenterPageProps) {
  const chainConfigured = isChainConfigured();

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
  const latestAttestationVerified =
    latestAttestation !== null &&
    isAttestorAllowlisted(latestAttestation.attestor);

  const platformAddresses = buildPlatformAddresses(custody);

  const demoNotice = demo
    ? DEMO_SANDBOX_DISCLAIMER
    : showDemoBanner
      ? "Demo data · Local visual QA — not production"
      : null;
  const showNotices = chainConfigured || demoNotice !== null;

  const coldEmpty = isProofCenterColdEmpty({
    demo,
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

      {coldEmpty ? (
        /* ── Cold state: compact honest shell + contracts (always visible) ── */
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
        /* ── Live state: 2-row × 2-col fit bento ── */
        <>
          {/* Row 1: PoR Summary (wider) | Mining Cash-Flow Evidence */}
          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
            {/* Panel A — Proof of Reserves */}
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Proof of Reserves"
                />
                <div className="proof-panel-scroll">
                  <PorSummary
                    attestation={latestAttestation}
                    custody={custody}
                    verified={latestAttestationVerified}
                    demo={demo}
                    sectionLed={false}
                  />
                </div>
              </div>
            </div>

            {/* Panel B — Mining Cash-Flow Evidence */}
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Mining cash-flow evidence"
                />
                <div className="proof-panel-scroll">
                  <MiningCashFlowEvidence coverage={coverage} sectionLed={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Recent Distributions | Rebalancing Events */}
          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
            {/* Panel C — Latest Distributions */}
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Latest distributions"
                  trailing={<AdminLeafLink href="/proof-center/full" label="View full" />}
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

            {/* Panel D — Rebalancing Events */}
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <AdminCockpitPanelHeader
                  title="Rebalancing events"
                  trailing={<AdminLeafLink href="/proof-center/full" label="View full" />}
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
