// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// Layer-1 fit bento hub: bounded widgets (PoR, cash-flow, distributions, rebalances).
// Unbounded content (event log, proofs grid, contracts, timelocks) → /proof-center/full

export const dynamic = "force-dynamic";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { isChainConfigured } from "@/lib/chain/client";
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
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoProofs } from "@/lib/demo/builders";
import { getProofs } from "@/lib/data/proofs";
import { databaseHasDemoProofs } from "@/lib/dev/investor-demo-visible";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { prisma } from "@/lib/db";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";

interface ProofCenterPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProductProofCenterPage({
  searchParams: _searchParams,
}: ProofCenterPageProps) {
  const chainConfigured = isChainConfigured();

  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);

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
  const attestationVerified = latestAttestationVerified(onChainAttestations);

  const platformAddresses = buildPlatformAddresses(custody);

  const demoNotice = demo
    ? DEMO_SANDBOX_DISCLAIMER
    : showDemoBanner
      ? "Demo data · Local visual QA — not production"
      : null;

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
    <ProofCenterHub
      variant="product"
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
      demo={demo}
      demoNotice={demoNotice}
    />
  );
}
