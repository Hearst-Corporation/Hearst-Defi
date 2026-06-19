// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth + DemoDataBanner.

export const dynamic = "force-dynamic";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
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
import { latestAttestationVerified } from "@/lib/proof-center/attestation-truth";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { prisma } from "@/lib/db";

export default async function AdminProofCenterPage() {
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
  const attestationVerified = latestAttestationVerified(onChainAttestations);

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
    <ProofCenterHub
      variant="admin"
      chainConfigured={chainConfigured}
      onChainEventsCount={onChainEvents.length}
      onChainAttestationCount={onChainAttestations.length}
      latestAttestation={latestAttestation}
      attestationVerified={attestationVerified}
      custody={custody}
      coverage={coverage}
      recentDistributions={recentDistributions}
      recentRebalances={recentRebalances}
      platformAddresses={platformAddresses}
      coldEmpty={coldEmpty}
      demo={showDemoBanner}
      showDemoBanner={showDemoBanner}
    />
  );
}
