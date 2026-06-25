import "server-only";

// Router Observability — retention / pruning policy (v1.1).
//
// Router decision traces are METADATA ONLY (no user text, prompts, secrets, or
// tool payloads). They are kept for a bounded horizon and pruned best-effort so
// the durable table never grows without limit. This module owns the retention
// horizon (env-overridable) and the pruning helper. It is NEVER called from the
// /admin/agentic data loader or the chat runtime — only from the best-effort
// write-time prune tick (db-store) or an explicit maintenance script.

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Default retention horizon (days) when no env override is provided. */
export const DURABLE_RETENTION_DAYS = 90;

/** Lower / upper sanity bounds for the env override (days). */
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 730;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Effective retention horizon in days. Reads the optional, non-secret
 * `ROUTER_TRACE_RETENTION_DAYS` env var (validated as a positive int at boot)
 * and clamps it to a sane range; falls back to the default. Boot-safe: a missing
 * value yields the default, and an out-of-range value is clamped, so a bad config
 * can never break the chat flow or hide data inside a shorter window than the UI
 * offers (the 30d window must always be <= retention).
 */
export function getRouterTraceRetentionDays(): number {
  const raw = env.ROUTER_TRACE_RETENTION_DAYS;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DURABLE_RETENTION_DAYS;
  }
  const clamped = Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, Math.floor(raw)));
  return clamped;
}

/** The cutoff Date: rows strictly older than this are eligible for pruning. */
export function getRouterTraceRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - getRouterTraceRetentionDays() * MS_PER_DAY);
}

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
 * A real delete requires an explicit `dryRun: false`. This makes the helper safe
 * to call from a maintenance script or a test without risk of accidental data
 * loss; the UI never calls it at all.
 *
 * Best-effort: on any DB error it logs at warn and returns `deleted: 0` rather
 * than throwing, so a maintenance run never crashes a process mid-way.
 */
export async function pruneRouterDecisionTraces(options?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<PruneRouterDecisionTracesResult> {
  const dryRun = options?.dryRun ?? true;
  const now = options?.now ?? new Date();
  const retentionDays = getRouterTraceRetentionDays();
  const cutoff = getRouterTraceRetentionCutoff(now);

  try {
    if (dryRun) {
      const deleted = await prisma.agenticRouterDecisionTrace.count({
        where: { createdAt: { lt: cutoff } },
      });
      return { retentionDays, cutoff: cutoff.toISOString(), deleted, dryRun: true };
    }
    const res = await prisma.agenticRouterDecisionTrace.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return {
      retentionDays,
      cutoff: cutoff.toISOString(),
      deleted: res.count,
      dryRun: false,
    };
  } catch (err) {
    logger.warn(
      "router-observability: pruneRouterDecisionTraces failed (non-blocking)",
      { dryRun },
      err instanceof Error ? err : undefined,
    );
    return { retentionDays, cutoff: cutoff.toISOString(), deleted: 0, dryRun };
  }
}

/** Constant, verbatim retention/privacy policy line for the admin UI. */
export const ROUTER_TRACE_RETENTION_POLICY_NOTE =
  "Retention policy: router decision metadata only, default 90 days. No user messages, prompts, secrets, or tool payloads are stored.";
