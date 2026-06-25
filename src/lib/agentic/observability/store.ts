import "server-only";

// Router Observability — store orchestrator (durable DB → Redis → memory).
//
// v1 prefers the durable Prisma table; on failure it falls back to the v0 Redis
// capped buffer, then a process-local globalThis buffer. NO user text is ever
// stored (see decision-summary.ts allowlist) so a single global key/table is
// privacy-safe. Every function is best-effort: it never throws into the chat flow.

import { getRedis } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  durableAppendTrace,
  durableReadTraces,
} from "./db-store";
import type {
  RouterDecisionTrace,
  RouterObservabilityStorage,
  RouterObservabilityWindow,
} from "./types";

/** Global Redis capped list key. No user text inside → a single key is safe. */
export const ROUTER_DECISIONS_KEY = "agentic:router:decisions";
/** Max traces the Redis/memory fallback retains. */
export const ROUTER_DECISIONS_CAP = 200;
/** TTL on the Redis fallback key — 7 days. */
const ROUTER_DECISIONS_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Best-effort prune cadence on durable writes (~1 in N). */
const PRUNE_EVERY = 50;

// Process-local fallback buffer (shared across route module instances in one
// runtime). Lost on cold start — surfaced honestly as "memory_fallback".
const globalForObs = globalThis as unknown as {
  __routerDecisions?: RouterDecisionTrace[];
  __routerWriteTick?: number;
};
const memBuffer: RouterDecisionTrace[] =
  globalForObs.__routerDecisions ?? (globalForObs.__routerDecisions = []);

function nextWriteTick(): number {
  const n = (globalForObs.__routerWriteTick ?? 0) + 1;
  globalForObs.__routerWriteTick = n;
  return n;
}

// ---------------------------------------------------------------------------
// Redis + memory primitives (v0 fallback layer)
// ---------------------------------------------------------------------------

function memAppend(trace: RouterDecisionTrace): void {
  memBuffer.unshift(trace);
  if (memBuffer.length > ROUTER_DECISIONS_CAP) {
    memBuffer.length = ROUTER_DECISIONS_CAP;
  }
}

/** Append to Redis. Returns true on success. */
async function redisAppend(trace: RouterDecisionTrace): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.lpush(ROUTER_DECISIONS_KEY, JSON.stringify(trace));
    await redis.ltrim(ROUTER_DECISIONS_KEY, 0, ROUTER_DECISIONS_CAP - 1);
    await redis.expire(ROUTER_DECISIONS_KEY, ROUTER_DECISIONS_TTL_SECONDS);
    return true;
  } catch (err) {
    logger.warn(
      "router-observability: Redis append failed (will fall back to memory)",
      {},
      err instanceof Error ? err : undefined,
    );
    return false;
  }
}

/**
 * Read recent traces from the v0 Redis/memory layer, newest first. Never throws.
 * (Kept as the fallback reader; the durable reader lives in db-store.ts.)
 */
export async function readRecentRouterDecisionTraces(
  limit = ROUTER_DECISIONS_CAP,
): Promise<RouterDecisionTrace[]> {
  const redis = getRedis();
  if (!redis) {
    return memBuffer.slice(0, limit);
  }
  try {
    const raw = await redis.lrange(ROUTER_DECISIONS_KEY, 0, limit - 1);
    return raw
      .map((entry): RouterDecisionTrace | null => {
        if (typeof entry === "object" && entry !== null) {
          return entry as RouterDecisionTrace;
        }
        try {
          return JSON.parse(entry as string) as RouterDecisionTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is RouterDecisionTrace => t !== null);
  } catch (err) {
    logger.warn(
      "router-observability: Redis read failed (falling back to memory)",
      {},
      err instanceof Error ? err : undefined,
    );
    return memBuffer.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Orchestrated write/read (v1)
// ---------------------------------------------------------------------------

/**
 * Append a trace: durable DB first, then Redis, always mirrored to memory.
 * Best-effort — never throws, never blocks the response. The memory mirror is
 * unconditional so tests + single-instance runtimes can always read back.
 */
export async function appendRouterDecisionTrace(
  trace: RouterDecisionTrace,
): Promise<void> {
  // Always mirror to memory first (last-resort fallback + test read-back).
  memAppend(trace);

  // Durable first — prune occasionally to bound the table.
  const pruneTick = nextWriteTick() % PRUNE_EVERY === 0;
  const durableOk = await durableAppendTrace(trace, { pruneTick });
  if (durableOk) return;

  // Durable failed → Redis fallback (memory already holds it).
  await redisAppend(trace);
}

export interface FallbackReadResult {
  traces: RouterDecisionTrace[];
  storage: RouterObservabilityStorage;
}

/**
 * Read traces for a window: durable DB first, then Redis, then memory. Returns
 * the traces + which backend served them. The Redis/memory fallbacks do not
 * support a time window (they are small + short-TTL), so the window is applied
 * best-effort in-memory after the fallback read. Never throws.
 */
export async function readTracesWithFallback(args: {
  window: RouterObservabilityWindow;
  limit: number;
  cutoffMs: number;
}): Promise<FallbackReadResult> {
  // 1) Durable
  const durable = await durableReadTraces({
    window: args.window,
    limit: args.limit,
  });
  if (durable.ok) {
    return { traces: durable.traces, storage: "durable" };
  }

  // 2) Redis (or memory if Redis absent) — apply the window best-effort.
  const redisAvailable = getRedis() !== null;
  const fallbackTraces = await readRecentRouterDecisionTraces(args.limit);
  const windowed = fallbackTraces.filter(
    (t) => Date.parse(t.createdAt) >= args.cutoffMs,
  );
  return {
    traces: windowed,
    storage: redisAvailable ? "redis_fallback" : "memory_fallback",
  };
}

/** TEST-ONLY: clear the in-memory buffer. No effect on Redis/DB. */
export function __resetRouterDecisionMemBuffer(): void {
  memBuffer.length = 0;
  globalForObs.__routerWriteTick = 0;
}
