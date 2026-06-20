// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth.

export const dynamic = "force-dynamic";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { latestAttestationVerified } from "@/lib/proof-center/attestation-truth";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { loadProofHubColdCounts } from "@/lib/proof-center/hub-counts";

export default async function AdminProofCenterPage() {
  const chainConfigured = isChainConfigured();
  const coveragePeriod = new Date().toISOString().slice(0, 7);

  const [
    onChainEvents,
    onChainAttestations,
    custody,
    coverage,
    recentDistributions,
    recentRebalances,
    coldCounts,
  ] = await Promise.all([
    fetchOnChainEvents({ limit: 20 }),
    fetchOnChainAttestations({ limit: 12 }),
    loadCustody(),
    loadCoverageForVault(PROOF_CENTER_VAULT_REF, coveragePeriod),
    loadRecentDistributions(PROOF_CENTER_VAULT_REF, 6),
    loadRecentRebalances(PROOF_CENTER_VAULT_REF, 5),
    loadProofHubColdCounts(),
  ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  const attestationVerified = latestAttestationVerified(onChainAttestations);

  const platformAddresses = buildPlatformAddresses(custody);

  const coldEmpty = isProofCenterColdEmpty({
    demo: false,
    hasAttestation: latestAttestation !== null,
    proofsCount: coldCounts.proofsCount,
    onChainEventsCount: onChainEvents.length,
    distributionsCount: recentDistributions.length,
    rebalancesCount: recentRebalances.length,
    timelockCount: coldCounts.timelockCount,
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
      demo={false}
    />
  );
}
