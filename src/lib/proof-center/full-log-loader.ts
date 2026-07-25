import "server-only";

import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { loadCustody } from "@/lib/data/custody";
import { getProofs } from "@/lib/data/proofs";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { prisma } from "@/lib/db";
import { resolveVault } from "@/lib/vaults/resolver";
import type { UnifiedProof } from "@/components/proof/proof-types";

/**
 * Prisma `where` fragment scoping TIMELOCK proposals to a vault reference.
 *
 * TOP9 fix (Z3): `GovernanceProposal` rows belong to `VaultDeployment` rows
 * (relation `vault`), NEVER to engine fixtures. The old filter
 * `vault: { ticker: vaultRef }` compared a deployment TICKER (e.g. "HYV-B")
 * to a fixture id ("yield") — a join that could never match, so the timelock
 * section always rendered "No pending timelocks" regardless of the real queue.
 *
 * - deployment ref (ticker or cuid) → scope to that deployment's proposals;
 * - fixture ref (yield/defensive/btc-plus) or unknown → fixtures own no
 *   GovernanceProposal rows, so a fixture-scoped filter can never match by
 *   construction. Return NO vault filter (platform-wide queue) instead of
 *   fabricating an always-empty section. Per-row vault tickers require the
 *   shared `proof-center-full-sections` component (investor surface) — out of
 *   E5 perimeter, flagged in the mission report.
 */
export async function timelockScopeWhere(
  vaultRef?: string,
): Promise<{ vaultDeploymentId?: string }> {
  if (!vaultRef) return {};
  const resolved = await resolveVault(vaultRef);
  if (resolved?.kind === "deployment") {
    return { vaultDeploymentId: resolved.deployment.id };
  }
  return {};
}

export async function loadProofCenterFullLog(vaultRef?: string) {
  const timelockScope = await timelockScopeWhere(vaultRef);

  const [onChainEvents, proofsResult, custody, timelockProposals] =
    await Promise.all([
      fetchOnChainEvents({ limit: 100 }),
      getProofs(),
      loadCustody(),
      prisma.governanceProposal.findMany({
        where: {
          state: "TIMELOCK",
          ...timelockScope,
        },
        orderBy: { queuedAt: "asc" },
      }),
    ]);

  const platformAddresses = buildPlatformAddresses(custody, vaultRef);

  // `source: "paper"` is the UnifiedProof TYPE DISCRIMINANT for rows read from
  // the off-chain `Proof` registry (vs. on-chain events/attestations fetched
  // separately) — it is structural, not a provenance claim. Row-level
  // provenance travels in `attestationVerified` (signature check) + `txHash`.
  const proofs: UnifiedProof[] = proofsResult.data.map(
    (p): UnifiedProof => ({ ...p, source: "paper" }),
  );

  return {
    onChainEvents,
    proofs,
    platformAddresses,
    timelockProposals,
    /** Total off-chain proofs on record — `proofs` holds the newest page only. */
    proofsTotal: proofsResult.total,
  };
}
