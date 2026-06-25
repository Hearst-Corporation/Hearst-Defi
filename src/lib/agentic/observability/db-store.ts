import "server-only";

// Router Observability v1 — durable Prisma store.
//
// Persists router-decision METADATA into AgenticRouterDecisionTrace and reads it
// back with a time-window. NO user text ever reaches here — the caller passes an
// already-sanitized RouterDecisionTrace (built by decision-summary's allowlist).
// Every function is best-effort: it never throws into the chat flow; callers
// decide the fallback. createdAt crosses the boundary as an ISO string in the
// type, and a Date in the DB.

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  RouterDecisionTrace,
  RouterLongTermDay,
  RouterMatchedRuleCount,
  RouterObservabilityWindow,
  RouterRetentionConfig,
} from "./types";
import { categorizeOutcome } from "./stats";

/** Window → milliseconds. */
const WINDOW_MS: Record<RouterObservabilityWindow, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Built-in default retention horizon (days) when OBS_RETENTION_DAYS is unset. */
export const DURABLE_RETENTION_DAYS = 90;

/**
 * Effective retention config: OBS_RETENTION_DAYS when set (bounded [1,365] by the
 * env schema), else the built-in default. Pure read of validated env.
 */
export function getRetentionConfig(): RouterRetentionConfig {
  const fromEnv = typeof env.OBS_RETENTION_DAYS === "number";
  return {
    retentionDays: fromEnv ? env.OBS_RETENTION_DAYS! : DURABLE_RETENTION_DAYS,
    fromEnv,
  };
}

/** Effective retention horizon (days). */
export function getRouterTraceRetentionDays(): number {
  return getRetentionConfig().retentionDays;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The cutoff Date: rows strictly older than this are eligible for pruning. */
export function getRouterTraceRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - getRouterTraceRetentionDays() * DAY_MS);
}

/** Cutoff Date for a window, relative to `now` (injected for testability). */
export function windowCutoff(window: RouterObservabilityWindow, now: number): Date {
  return new Date(now - WINDOW_MS[window]);
}

/** Map an array-or-unknown matchedRuleIds (Json column) to string[]. */
function normalizeRuleIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/** Convert a DB row into the public RouterDecisionTrace (createdAt → ISO). */
function rowToTrace(row: {
  id: string;
  createdAt: Date;
  chatId: string | null;
  messageId: string | null;
  source: string;
  kind: string;
  actionPolicy: string;
  confidence: number | null;
  negated: boolean;
  matchedRuleIds: unknown;
  routeKey: string | null;
  educationalKind: string | null;
  prohibitedAutonomousAction: boolean;
  outcome: string;
  usedLegacyFallback: boolean;
  tookFastPath: boolean;
}): RouterDecisionTrace {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    ...(row.chatId ? { chatId: row.chatId } : {}),
    ...(row.messageId ? { messageId: row.messageId } : {}),
    kind: row.kind,
    actionPolicy: row.actionPolicy,
    ...(row.confidence !== null ? { confidence: row.confidence } : {}),
    negated: row.negated,
    matchedRuleIds: normalizeRuleIds(row.matchedRuleIds),
    ...(row.routeKey ? { routeKey: row.routeKey } : {}),
    ...(row.educationalKind ? { educationalKind: row.educationalKind } : {}),
    prohibitedAutonomousAction: row.prohibitedAutonomousAction,
    outcome: row.outcome as RouterDecisionTrace["outcome"],
    usedLegacyFallback: row.usedLegacyFallback,
    tookFastPath: row.tookFastPath,
    source: "cockpit_chat",
  };
}

/**
 * Insert one trace durably. Returns true on success, false on any failure (so
 * the orchestrator can fall back). NEVER throws.
 *
 * Best-effort retention: ~1 write in 50 also prunes rows older than the horizon.
 * The prune is fire-and-forget and its failure is ignored — no cron required.
 */
export async function durableAppendTrace(
  trace: RouterDecisionTrace,
  opts?: { pruneTick?: boolean },
): Promise<boolean> {
  try {
    await prisma.agenticRouterDecisionTrace.create({
      data: {
        id: trace.id,
        createdAt: new Date(trace.createdAt),
        chatId: trace.chatId ?? null,
        messageId: trace.messageId ?? null,
        source: trace.source,
        kind: trace.kind,
        actionPolicy: trace.actionPolicy,
        confidence: trace.confidence ?? null,
        negated: trace.negated,
        matchedRuleIds: trace.matchedRuleIds,
        routeKey: trace.routeKey ?? null,
        educationalKind: trace.educationalKind ?? null,
        prohibitedAutonomousAction: trace.prohibitedAutonomousAction,
        outcome: trace.outcome,
        usedLegacyFallback: trace.usedLegacyFallback,
        tookFastPath: trace.tookFastPath,
      },
    });
    if (opts?.pruneTick) {
      void pruneOldTraces().catch(() => {
        /* best-effort retention — never blocks, never throws */
      });
    }
    return true;
  } catch (err) {
    logger.warn(
      "router-observability: durable trace insert failed (will fall back)",
      {},
      err instanceof Error ? err : undefined,
    );
    return false;
  }
}

/** Best-effort delete of rows older than the effective retention horizon. */
export async function pruneOldTraces(now: number = Date.now()): Promise<void> {
  const cutoff = getRouterTraceRetentionCutoff(new Date(now));
  await prisma.agenticRouterDecisionTrace.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}

/** Count rows older than the retention horizon (used by the dry-run prune). */
export async function countTracesOlderThanRetention(
  now: number = Date.now(),
): Promise<number> {
  const cutoff = getRouterTraceRetentionCutoff(new Date(now));
  return prisma.agenticRouterDecisionTrace.count({
    where: { createdAt: { lt: cutoff } },
  });
}

/** Delete rows older than the retention horizon; returns the deleted count. */
export async function deleteTracesOlderThanRetention(
  now: number = Date.now(),
): Promise<number> {
  const cutoff = getRouterTraceRetentionCutoff(new Date(now));
  const res = await prisma.agenticRouterDecisionTrace.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return res.count;
}

/** Result of a durable read attempt. `ok=false` ⇒ caller should fall back. */
export interface DurableReadResult {
  ok: boolean;
  traces: RouterDecisionTrace[];
}

/**
 * Read traces within a window, newest first, capped at `limit`. Returns
 * `{ ok: false, traces: [] }` on any DB failure (incl. table-missing pre-migration)
 * so the orchestrator falls back to Redis/memory. NEVER throws.
 */
export async function durableReadTraces(args: {
  window: RouterObservabilityWindow;
  limit: number;
  now?: number;
}): Promise<DurableReadResult> {
  try {
    const cutoff = windowCutoff(args.window, args.now ?? Date.now());
    const rows = await prisma.agenticRouterDecisionTrace.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: args.limit,
    });
    return { ok: true, traces: rows.map(rowToTrace) };
  } catch (err) {
    logger.warn(
      "router-observability: durable read failed (will fall back)",
      {},
      err instanceof Error ? err : undefined,
    );
    return { ok: false, traces: [] };
  }
}

/**
 * Top matched rules within a window. Computed in SQL where possible; here we
 * derive from the windowed rows we already read (matchedRuleIds is a Json array,
 * not groupable directly). Pure given the input rows.
 */
export function topMatchedRules(
  traces: readonly RouterDecisionTrace[],
  limit = 5,
): RouterMatchedRuleCount[] {
  const counts = new Map<string, number>();
  for (const t of traces) {
    for (const ruleId of t.matchedRuleIds) {
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId))
    .slice(0, limit);
}

/** "YYYY-MM-DD" for an instant, in UTC. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Result of a durable long-term aggregate. `ok=false` ⇒ DB unavailable. */
export interface DurableAggregateResult {
  ok: boolean;
  days: RouterLongTermDay[];
}

/**
 * Per-UTC-day outcome counts over the last `horizonDays`, oldest first. Reads ONLY
 * createdAt + outcome (a narrow, indexed projection) within the horizon, then
 * buckets by day in JS — bounded by retention, no full-row load, no user text.
 * Returns `{ ok: false, days: [] }` on any DB failure. NEVER throws.
 */
export async function durableAggregateByDay(args: {
  horizonDays: number;
  now?: number;
}): Promise<DurableAggregateResult> {
  const now = args.now ?? Date.now();
  // Clamp the horizon to [1, retention] so we never claim more history than kept.
  const { retentionDays } = getRetentionConfig();
  const horizon = Math.max(1, Math.min(args.horizonDays, retentionDays));
  const cutoff = new Date(now - horizon * DAY_MS);

  try {
    const rows = await prisma.agenticRouterDecisionTrace.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { createdAt: true, outcome: true },
      orderBy: { createdAt: "asc" },
    });

    // Pre-seed every day in the horizon so gaps render as zero rows.
    const byDay = new Map<string, RouterLongTermDay>();
    for (let i = horizon - 1; i >= 0; i--) {
      const key = utcDayKey(new Date(now - i * DAY_MS));
      byDay.set(key, {
        date: key,
        total: 0,
        navigationFastPaths: 0,
        dangerousRefusals: 0,
        educationalTurns: 0,
        negatedNoNav: 0,
        normalOrUnknown: 0,
      });
    }

    for (const row of rows) {
      const key = utcDayKey(row.createdAt);
      const day = byDay.get(key);
      if (!day) continue; // outside the seeded horizon — ignore defensively
      day.total += 1;
      day[categorizeOutcome(row.outcome)] += 1;
    }

    return { ok: true, days: [...byDay.values()] };
  } catch (err) {
    logger.warn(
      "router-observability: durable aggregate failed (long-term view unavailable)",
      {},
      err instanceof Error ? err : undefined,
    );
    return { ok: false, days: [] };
  }
}
