import "server-only";

import { prisma } from "@/lib/db";

/** Count-only fetch for proof hub cold-empty — avoids loading full proof rows / timelock entities. */
export async function loadProofHubColdCounts(): Promise<{ proofsCount: number; timelockCount: number }> {
  const [proofsCount, timelockCount] = await Promise.all([
    prisma.proof.count(),
    prisma.governanceProposal.count({ where: { state: "TIMELOCK" } }),
  ]);

  return { proofsCount, timelockCount };
}

/**
 * Institutional evidence counts for the Series 1 proof rail. Count-only — used
 * to badge each block with how much off-chain evidence backs it, without loading
 * full rows. Distributions are counted for de-prioritization bookkeeping only:
 * Series 1 has no periodic cash distribution, so a non-zero count here means
 * on-chain *settlement* rows, never a recurring payout.
 */
export interface ProofHubEvidenceCounts {
  /** Off-chain proof documents (mining attestations, custody letters, etc.). */
  proofsCount: number;
  /** Governance proposals currently in timelock. */
  timelockCount: number;
  /** Settlement / distribution rows on file (de-prioritized for Series 1). */
  distributionsCount: number;
}

export async function loadProofHubEvidenceCounts(): Promise<ProofHubEvidenceCounts> {
  const [proofsCount, timelockCount, distributionsCount] = await Promise.all([
    prisma.proof.count(),
    prisma.governanceProposal.count({ where: { state: "TIMELOCK" } }),
    prisma.distribution.count(),
  ]);

  return { proofsCount, timelockCount, distributionsCount };
}
