import "server-only";

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
import type { CoverageView } from "@/lib/engine/coverage-view";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import type {
  ProofCenterDistributionRow,
  ProofCenterRebalanceRow,
} from "@/lib/data/proof-center";
import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { latestAttestationVerified } from "@/lib/proof-center/attestation-truth";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { loadProofHubColdCounts } from "@/lib/proof-center/hub-counts";

// The Series 1 block-provenance rules (attestationBlockProvenance,
// custodyBlockProvenance, eventBlockProvenance, buildSeries1Proof, …) live in
// the PURE module `block-provenance.ts` — testable without Prisma/chain
// clients. Re-exported here so historical import paths keep working.
export type {
  ProofBlockKind,
  ProofBlockProvenance,
  ProofBlockState,
  ProofFreshnessEntry,
  ReservePocketCoverage,
  Series1ProofBlock,
} from "@/lib/proof-center/block-provenance";

/**
 * Payload consumed by the shared investor/admin Proof Center hub
 * (`ProofCenterHubLayout` spreads it into `ProofCenterHub`).
 *
 * E5 honesty pass: the previously-returned `series1Proof` / `proofFreshness` /
 * `reservePockets` / `distributionsCount` / `distributionsDeprioritized`
 * fields were computed on EVERY request and destructured by NO consumer
 * (dead payload, Z3 TOP7). They are gone from the payload; the underlying
 * logic remains exported + tested in `block-provenance.ts`, recommended for
 * future wiring into the shared proof rail (product chantier).
 */
export interface ProofCenterHubData {
  chainConfigured: boolean;
  latestAttestation: OnChainAttestation | null;
  attestationVerified: boolean;
  custody: CustodySnapshot | null;
  coverage: CoverageView;
  recentDistributions: ProofCenterDistributionRow[];
  recentRebalances: ProofCenterRebalanceRow[];
  platformAddresses: PlatformAddressEntry[];
  coldEmpty: boolean;
}

/** Shared loader for investor + admin Proof Center hub pages. */
export async function loadProofCenterHubData(
  demo = false,
  vaultRef: string = PROOF_CENTER_VAULT_REF,
): Promise<ProofCenterHubData> {
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
    loadCoverageForVault(vaultRef, coveragePeriod),
    loadRecentDistributions(vaultRef, 6),
    loadRecentRebalances(vaultRef, 5),
    loadProofHubColdCounts(),
  ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  const attestationVerified = latestAttestationVerified(onChainAttestations);

  return {
    chainConfigured: isChainConfigured(),
    latestAttestation,
    attestationVerified,
    custody,
    coverage,
    recentDistributions,
    recentRebalances,
    platformAddresses: buildPlatformAddresses(custody, vaultRef),
    coldEmpty: isProofCenterColdEmpty({
      demo,
      hasAttestation: latestAttestation !== null,
      proofsCount: coldCounts.proofsCount,
      onChainEventsCount: onChainEvents.length,
      distributionsCount: recentDistributions.length,
      rebalancesCount: recentRebalances.length,
      timelockCount: coldCounts.timelockCount,
    }),
  };
}
