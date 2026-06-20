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
