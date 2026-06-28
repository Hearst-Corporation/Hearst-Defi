import "server-only";

import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { prisma } from "@/lib/db";
import type { UnifiedProof } from "@/components/proof/proof-types";

export async function loadProofCenterFullLog(vaultRef?: string) {
  const [onChainEvents, proofsResult, custody, timelockProposals] =
    await Promise.all([
      fetchOnChainEvents({ limit: 100 }),
      getProofs(),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: {
          state: "TIMELOCK",
          ...(vaultRef ? { vault: { ticker: vaultRef } } : {}),
        },
        orderBy: { queuedAt: "asc" },
      }),
    ]);

  const platformAddresses = buildPlatformAddresses(custody, vaultRef);

  const proofs: UnifiedProof[] = proofsResult.data.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return {
    onChainEvents,
    proofs,
    platformAddresses,
    timelockProposals,
  };
}
