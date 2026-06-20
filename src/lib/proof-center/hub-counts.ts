import "server-only";

import { prisma } from "@/lib/db";
import { DEMO_PROOF_ITEM_COUNT } from "@/lib/demo/builders";

/**
 * Count-only fetch for proof hub cold-empty — avoids loading full proof rows / timelock entities.
 *
 * `demo` is an optional legacy param kept for the admin panel (which still has a demo mode).
 * The investor product always calls this without args (no demo path for real investors).
 */
export async function loadProofHubColdCounts(demo?: boolean): Promise<{
  proofsCount: number;
  timelockCount: number;
}> {
  if (demo) {
    return { proofsCount: DEMO_PROOF_ITEM_COUNT, timelockCount: 0 };
  }

  const [proofsCount, timelockCount] = await Promise.all([
    prisma.proof.count(),
    prisma.governanceProposal.count({ where: { state: "TIMELOCK" } }),
  ]);

  return { proofsCount, timelockCount };
}
