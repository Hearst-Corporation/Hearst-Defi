import "server-only";

/**
 * VaultSnapshot `source` values written by real production code or canonical
 * history. Structural seed guard: readers filtering on this allowlist can
 * NEVER serve a reappeared `demo_seed`, `daily-seed` (synthetic seed rows —
 * prisma/seed.ts) or any unknown demo/fake source as real vault state, even
 * if such rows return to the table. Only sources with a verified real writer
 * belong here: "live" (custody-snapshot-hourly cron) and "backfill"
 * (canonical monthly history, see agents/loaders/vault.ts).
 *
 * Kept dependency-free (no next/cache, no prisma) so any layer — llm tools,
 * agent loaders, inngest crons — can import it without pulling runtime deps.
 */
export const AUTHORITATIVE_VAULT_SNAPSHOT_SOURCES = [
  "live",
  "backfill",
] as const;

/** Prisma `where.source` fragment applying {@link AUTHORITATIVE_VAULT_SNAPSHOT_SOURCES}. */
export function authoritativeVaultSnapshotWhere(): { source: { in: string[] } } {
  return { source: { in: [...AUTHORITATIVE_VAULT_SNAPSHOT_SOURCES] } };
}
