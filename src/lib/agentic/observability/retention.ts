import "server-only";

// Router Observability — retention pruning helper (v1.1).
//
// The effective retention horizon + env override (OBS_RETENTION_DAYS) live in
// db-store (getRetentionConfig / getRouterTraceRetentionDays / cutoff). This
// module adds ONE thing on top: a SAFE, dry-run-by-default prune helper for an
// explicit maintenance script or a test. It is NEVER called from the
// /admin/agentic data loader or the chat runtime — the only automatic prune is
// the best-effort write-time tick inside db-store.

import {
  getRouterTraceRetentionDays,
  getRouterTraceRetentionCutoff,
  countTracesOlderThanRetention,
  deleteTracesOlderThanRetention,
} from "./db-store";
import { logger } from "@/lib/logger";

export interface PruneRouterDecisionTracesResult {
  retentionDays: number;
  /** ISO cutoff — rows with createdAt < cutoff were (or would be) deleted. */
  cutoff: string;
  /** Rows deleted (or, in dry-run, the count that WOULD be deleted). */
  deleted: number;
  dryRun: boolean;
}

/**
 * Prune router decision traces older than the retention horizon.
 *
 * `dryRun` (DEFAULT true) only COUNTS the eligible rows — it deletes nothing.
 * A real delete requires an explicit `dryRun: false`. Safe to call from a
 * maintenance script or a test without risk of accidental data loss; the UI
 * never calls it. Best-effort: on any DB error it logs at warn and returns
 * `deleted: 0` rather than throwing.
 */
export async function pruneRouterDecisionTraces(options?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<PruneRouterDecisionTracesResult> {
  const dryRun = options?.dryRun ?? true;
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  const retentionDays = getRouterTraceRetentionDays();
  const cutoff = getRouterTraceRetentionCutoff(now).toISOString();

  try {
    const deleted = dryRun
      ? await countTracesOlderThanRetention(nowMs)
      : await deleteTracesOlderThanRetention(nowMs);
    return { retentionDays, cutoff, deleted, dryRun };
  } catch (err) {
    logger.warn(
      "router-observability: pruneRouterDecisionTraces failed (non-blocking)",
      { dryRun },
      err instanceof Error ? err : undefined,
    );
    return { retentionDays, cutoff, deleted: 0, dryRun };
  }
}
