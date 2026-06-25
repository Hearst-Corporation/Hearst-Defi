import "server-only";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Shared audit helper for admin actions.
 * Records a row in the AdminAudit table with a JSON diff.
 * Supports optional transaction client.
 */
export async function recordAdminAudit(
  params: {
    actorWallet: string;
    action: string; // "vault.submitForReview", "rebalance.approve", etc.
    entityType: string; // "VaultDeployment" | "RebalanceEvent" | "Distribution" | "ProjectionStudyRun"
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
  },
  prisma = defaultPrisma,
): Promise<void> {
  await prisma.adminAudit.create({
    data: {
      actorWallet: params.actorWallet,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      diff: JSON.stringify({
        before: params.before ?? null,
        after: params.after ?? null,
      }),
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export interface AdminAuditEntry {
  id: string;
  occurredAt: Date;
  actorWallet: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown; // parsed from diff JSON, fail-safe to null
  ip: string | null;
  userAgent: string | null;
}

export interface AdminAuditFilter {
  entityType?: string;
  actorWallet?: string;
  action?: string;
  limit?: number;
}

/**
 * Parse the stored `diff` JSON string into `{ before, after }`.
 * Safe: returns `{ before: null, after: null }` on any parse error.
 * Exported for unit testing without a DB dependency.
 */
export function parseAuditDiff(diff: string): { before: unknown; after: unknown } {
  try {
    const parsed = JSON.parse(diff) as { before?: unknown; after?: unknown };
    return {
      before: parsed.before ?? null,
      after: parsed.after ?? null,
    };
  } catch {
    return { before: null, after: null };
  }
}

/**
 * Query the AdminAudit table with optional filters.
 * Results are ordered newest-first; capped at `filter.limit ?? 200`.
 */
export async function getAdminAuditLog(
  filter: AdminAuditFilter = {},
): Promise<AdminAuditEntry[]> {
  const where: {
    entityType?: string;
    actorWallet?: { contains: string };
    action?: { contains: string };
  } = {};

  if (filter.entityType) {
    where.entityType = filter.entityType;
  }
  if (filter.actorWallet) {
    // Plain `contains` (no `mode`) so the query behaves identically on Postgres
    // (prod) and SQLite (dev) — SQLite's Prisma connector rejects
    // `mode: "insensitive"` at query time.
    where.actorWallet = {
      contains: filter.actorWallet,
    };
  }
  if (filter.action) {
    where.action = { contains: filter.action };
  }

  const rows = await prisma.adminAudit.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: filter.limit ?? 200,
  });

  return rows.map((row) => {
    const { before, after } = parseAuditDiff(row.diff);
    return {
      id: row.id,
      occurredAt: row.occurredAt,
      actorWallet: row.actorWallet,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before,
      after,
      ip: row.ip,
      userAgent: row.userAgent,
    };
  });
}
