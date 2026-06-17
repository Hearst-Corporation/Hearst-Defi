import "server-only";

import { prisma } from "@/lib/db";

/** Default vault scope for the investor Proof Center (Hearst Yield Vault). */
export const PROOF_CENTER_VAULT_REF = "hearst-yield-vault" as const;

export interface ProofCenterDistributionRow {
  id: string;
  period: string;
  amountUsdc: number;
  recipientsCount: number;
  distributedAt: Date;
  txHash: string | null;
}

export interface ProofCenterRebalanceRow {
  id: string;
  ruleId: string;
  triggeredAt: Date;
  executedAt: Date;
  status: string;
  txHash: string | null;
  projection: string;
  triggerText: string;
  actionText: string;
  impactText: string;
}

function vaultScopeWhere(vaultRef: string) {
  // Legacy rows may use engine fixture id "yield" or null vaultRef.
  return {
    OR: [{ vaultRef }, { vaultRef: "yield" }, { vaultRef: null }],
  };
}

/** Last N distributions for a vault (spec: 3–6). */
export async function loadRecentDistributions(
  vaultRef: string = PROOF_CENTER_VAULT_REF,
  limit = 6,
): Promise<ProofCenterDistributionRow[]> {
  const rows = await prisma.distribution.findMany({
    where: vaultScopeWhere(vaultRef),
    orderBy: { distributedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    period: row.period,
    amountUsdc: row.amountUsdc.toNumber(),
    recipientsCount: row.recipientsCount,
    distributedAt: row.distributedAt,
    txHash: row.txHash,
  }));
}

/** Last N rebalancing signals for a vault (spec: 5). */
export async function loadRecentRebalances(
  vaultRef: string = PROOF_CENTER_VAULT_REF,
  limit = 5,
): Promise<ProofCenterRebalanceRow[]> {
  const rows = await prisma.rebalanceEvent.findMany({
    where: {
      ...vaultScopeWhere(vaultRef),
      status: { in: ["executed", "approved", "pending"] },
    },
    orderBy: [{ triggeredAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    ruleId: row.ruleId,
    triggeredAt: row.triggeredAt,
    executedAt: row.executedAt,
    status: row.status,
    txHash: row.txHash,
    projection: row.projection,
    triggerText: row.triggerText,
    actionText: row.actionText,
    impactText: row.impactText,
  }));
}
