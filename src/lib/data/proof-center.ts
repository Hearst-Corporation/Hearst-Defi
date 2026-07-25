import "server-only";

import { prisma } from "@/lib/db";
import {
  distributionVaultScopeWhere,
  resolveDistributionVaultScopeId,
} from "@/lib/vaults/dashboard-scope";

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

/**
 * Strict vault scope for RebalanceEvent rows — mirrors
 * `distributionVaultScopeWhere` (dashboard-scope.ts).
 *
 * E5 fix (Z3 "fuite de scope"): the old clause OR-ed `{vaultRef: "yield"}` and
 * `{vaultRef: null}` into EVERY scope, so a defensive/btc-plus scope silently
 * surfaced the flagship's rows. Now:
 * - flagship scope ("yield" / legacy "hearst-yield-vault") includes the legacy
 *   slug AND unscoped rows (`vaultRef: null`) — pre-multi-vault events were
 *   written without a vaultRef and are ASSUMED to belong to the Series 1
 *   flagship (documented assumption: "includes unscoped events");
 * - any other scope matches its own vaultRef ONLY.
 */
function rebalanceVaultScopeWhere(vaultRef: string) {
  const scopeId = resolveDistributionVaultScopeId(vaultRef);
  if (scopeId === "yield") {
    return {
      OR: [
        { vaultRef: "yield" },
        { vaultRef: "hearst-yield-vault" },
        { vaultRef: null },
      ],
    };
  }
  return { vaultRef: scopeId };
}

/** Last N distributions for a vault (spec: 3–6). */
export async function loadRecentDistributions(
  vaultRef: string = PROOF_CENTER_VAULT_REF,
  limit = 6,
): Promise<ProofCenterDistributionRow[]> {
  const rows = await prisma.distribution.findMany({
    where: distributionVaultScopeWhere(resolveDistributionVaultScopeId(vaultRef)),
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

/**
 * Last N rebalancing signals for a vault (spec: 5).
 *
 * Status scope: `executed` / `approved` / `pending` only — `cancelled` (and
 * admin-rejected) events are EXCLUDED by design from the proof surfaces: the
 * Proof Center evidences operations that happened or are in flight, not
 * operations that were called off. Declared here because the shared panel
 * (investor surface) cannot carry the mention — see E5 report SIGNALEMENT.
 */
export async function loadRecentRebalances(
  vaultRef: string = PROOF_CENTER_VAULT_REF,
  limit = 5,
): Promise<ProofCenterRebalanceRow[]> {
  const rows = await prisma.rebalanceEvent.findMany({
    where: {
      ...rebalanceVaultScopeWhere(vaultRef),
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
