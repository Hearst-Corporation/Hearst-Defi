export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { PLATFORM_PROOFS_EMPTY } from "@/components/proof/empty-messages";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { PorSummary } from "@/components/proof-center/por-summary";
import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { RebalancingEventsPanel } from "@/components/proof-center/rebalancing-events-panel";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import { ProofFilter } from "@/components/proof/proof-filter";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { ProofGrid } from "@/components/proof/proof-grid";
import type { UnifiedProof } from "@/components/proof/proof-types";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";

interface AdminProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[]; vault?: string }>;
}

export default async function AdminProofCenterPage({
  searchParams,
}: AdminProofCenterPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const vaultParam = Array.isArray(params.vault) ? params.vault[0] : params.vault;
  if (vaultParam) {
    const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
    const qs =
      rawType != null && rawType !== ""
        ? `?type=${encodeURIComponent(rawType)}`
        : "";
    redirect(`/admin/proof-center${qs}`);
  }

  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);
  const coveragePeriod = new Date().toISOString().slice(0, 7);

  const chainConfigured = isChainConfigured();
  const [
    onChainEvents,
    onChainAttestations,
    paper,
    custody,
    showDemoBanner,
    coverage,
    recentDistributions,
    recentRebalances,
  ] = await Promise.all([
    fetchOnChainEvents({ limit: 20 }),
    fetchOnChainAttestations({ limit: 12 }),
    getProofs().then((r) => r.data),
    loadCustody(),
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

  const proofs: UnifiedProof[] = paper.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Proof Center"
        description="Reserve attestations, on-chain events, and proof documents for operator review."
        actions={
          <ChainStatusBadge
            configured={chainConfigured}
            eventCount={onChainEvents.length}
            attestationCount={onChainAttestations.length}
          />
        }
      />

      {showDemoBanner ? <DemoDataBanner /> : null}

      <section aria-labelledby="por-heading">
        <h2 id="por-heading" className="sr-only">
          Proof of Reserves
        </h2>
        <PorSummary
          attestation={latestAttestation}
          custody={custody}
          verified={latestAttestationVerified}
        />
      </section>

      <section aria-labelledby="cashflow-heading">
        <h2 id="cashflow-heading" className="sr-only">
          Mining cash-flow evidence
        </h2>
        <MiningCashFlowEvidence coverage={coverage} />
      </section>

      <section aria-labelledby="distributions-heading">
        <h2 id="distributions-heading" className="sr-only">
          Latest distributions
        </h2>
        <RecentDistributions distributions={recentDistributions} />
      </section>

      <section aria-labelledby="rebalance-heading">
        <h2 id="rebalance-heading" className="sr-only">
          Rebalancing events
        </h2>
        <RebalancingEventsPanel events={recentRebalances} />
      </section>

      <section aria-labelledby="event-timeline-heading">
        <h2 id="event-timeline-heading" className="sr-only">
          On-chain event log
        </h2>
        <EventTimeline events={onChainEvents} />
      </section>

      <section aria-labelledby="proof-grid-heading">
        <div className="mb-6 admin-doc-section__head">
          <h2 id="proof-grid-heading" className="h2">
            Off-chain proofs &amp; documents
          </h2>
          {proofs.length > 0 ? <ProofFilter /> : null}
        </div>
        {proofs.length === 0 ? (
          <AwaitingMetricState {...PLATFORM_PROOFS_EMPTY} />
        ) : (
          <ProofGrid proofs={proofs} filter={filter} />
        )}
      </section>

      <section aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className="h2 mb-6">
          Contracts &amp; review trail
        </h2>
        <ContractsAuditTrail platformAddresses={platformAddresses} />
      </section>
    </div>
  );
}
