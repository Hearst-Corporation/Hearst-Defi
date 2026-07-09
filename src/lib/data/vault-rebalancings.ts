import "server-only";

import { prisma } from "@/lib/db";
import type { RebalancingEvent } from "@/app/(product)/portfolio/preview/_charts/rebalancing-feed";
import { distributionVaultScopeWhere } from "@/lib/vaults/dashboard-scope";
import type { VaultId } from "@/lib/engine/types";

/**
 * Real vault-level rebalancing feed for the investor cockpit.
 *
 * Reads the actual `RebalanceEvent` rows (the same table the admin Signals
 * console writes / reads) and maps them to the cockpit's `RebalancingEvent`
 * shape. This is VAULT-WIDE operational data — a rebalancing applies to the
 * whole vault, NOT to one investor's position (the model has no `investorId`).
 * It is therefore surfaced to the LP as an operational feed, badged
 * "vault-level", never presented as a personalised, per-investor event — in
 * line with the mining/ops rule that fleet/operation metrics are general, not
 * per-investor.
 *
 * Returns [] when the table has no rows for the vault — the caller then shows
 * an honest empty state instead of the old hardcoded PILOT sample.
 */

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** RebalanceEvent.status → feed dot tone. */
function toneFor(status: string): RebalancingEvent["tone"] {
  switch (status) {
    case "executed":
    case "approved":
      return "done";
    case "cancelled":
      return "review";
    // pending + anything unknown → neutral/info
    default:
      return "info";
  }
}

/**
 * Load the real rebalancing events for a fixture vault, newest first, mapped to
 * the cockpit feed shape. Scope reuses `distributionVaultScopeWhere` so the
 * yield vault also picks up legacy (`hearst-yield-vault`) and pre-multi-vault
 * (`null`) rows — identical to the admin Signals / distributions scoping.
 */
export async function loadVaultRebalancings(
  vaultId: VaultId = "yield",
  limit = 12,
  options?: { since?: Date | null },
): Promise<{ events: RebalancingEvent[]; hasPriorRebalancings: boolean }> {
  const scopedWhere = distributionVaultScopeWhere(vaultId);
  const since = options?.since ?? null;

  const rows = await prisma.rebalanceEvent.findMany({
    where: since
      ? {
          ...scopedWhere,
          triggeredAt: { gte: since },
        }
      : scopedWhere,
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });

  const events = rows.map((r) => ({
    id: r.id,
    // Dated on triggeredAt (when the signal fired) — consistent with the sort
    // order above. executedAt is `@default(now())` set at INSERT time, so a
    // pending/cancelled event would otherwise carry a fake "executed" date.
    at: MONTH_YEAR.format(r.triggeredAt),
    // Action is the human-facing "what changed"; fall back to the trigger when
    // an action wasn't recorded. Never fabricated — straight from the DB row.
    summary: r.actionText?.trim() || r.triggerText?.trim() || "Rebalancing recorded.",
    tone: toneFor(r.status),
  }));

  let hasPriorRebalancings = false;
  if (since) {
    const prior = await prisma.rebalanceEvent.findFirst({
      where: {
        ...scopedWhere,
        triggeredAt: { lt: since },
      },
      select: { id: true },
    });
    hasPriorRebalancings = Boolean(prior);
  }

  return { events, hasPriorRebalancings };
}
