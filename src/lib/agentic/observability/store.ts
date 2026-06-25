import "server-only";

// Router Observability v0 — capped store (Redis with in-memory fallback).
//
// A GLOBAL, admin-only capped buffer of recent router-decision traces. NO user
// text is ever stored (see decision-summary.ts), so a single global key is
// privacy-safe and lets the admin page show a cross-turn recent view without a
// userId. Mirrors the nav-channel.ts pattern: Upstash Redis when configured,
// else a process-local globalThis buffer (dev / single instance).
//
// NO Prisma, NO migration, NO schema change. Recording is best-effort and never
// throws into the caller. Reading is admin-only (callers gate auth upstream).

import { getRedis } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type {
  RouterDecisionTrace,
  RouterObservabilityStorage,
} from "./types";

/** Global capped list key. No user text inside → a single global key is safe. */
export const ROUTER_DECISIONS_KEY = "agentic:router:decisions";
/** Max traces retained (newest-first). Bounds memory + Redis size. */
export const ROUTER_DECISIONS_CAP = 200;
/** TTL on the Redis key (observability, not regulatory retention) — 7 days. */
const ROUTER_DECISIONS_TTL_SECONDS = 7 * 24 * 60 * 60;

// Process-local fallback buffer (shared across route module instances in one
// runtime). Used only when Redis is not configured. Lost on cold start — that is
// acceptable for v0 and surfaced honestly as the "memory" storage mode.
const globalForObs = globalThis as unknown as {
  __routerDecisions?: RouterDecisionTrace[];
};
const memBuffer: RouterDecisionTrace[] =
  globalForObs.__routerDecisions ?? (globalForObs.__routerDecisions = []);

/** Which backend is active right now. */
export function getObservabilityStorage(): RouterObservabilityStorage {
  return getRedis() ? "redis" : "memory";
}

/**
 * Append a trace to the capped buffer. Best-effort: never throws, never blocks
 * the caller's response. On Redis: LPUSH + LTRIM + EXPIRE. Else: in-memory unshift
 * + slice. A failure is logged at warn and swallowed.
 */
export async function appendRouterDecisionTrace(
  trace: RouterDecisionTrace,
): Promise<void> {
  // Always mirror into the in-memory buffer so a single-instance runtime (and
  // tests) can read back even when Redis is configured but unreachable.
  memBuffer.unshift(trace);
  if (memBuffer.length > ROUTER_DECISIONS_CAP) {
    memBuffer.length = ROUTER_DECISIONS_CAP;
  }

  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lpush(ROUTER_DECISIONS_KEY, JSON.stringify(trace));
    await redis.ltrim(ROUTER_DECISIONS_KEY, 0, ROUTER_DECISIONS_CAP - 1);
    await redis.expire(ROUTER_DECISIONS_KEY, ROUTER_DECISIONS_TTL_SECONDS);
  } catch (err) {
    logger.warn(
      "router-observability: trace append to Redis failed (non-blocking)",
      {},
      err instanceof Error ? err : undefined,
    );
  }
}

/**
 * Read recent traces, newest first. Redis is authoritative when configured;
 * otherwise the in-memory buffer. Never throws — on a read error returns [].
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
        // @upstash/redis may auto-deserialize JSON; handle both shapes.
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
      "router-observability: trace read from Redis failed",
      {},
      err instanceof Error ? err : undefined,
    );
    // Fall back to whatever the in-memory buffer holds rather than crashing.
    return memBuffer.slice(0, limit);
  }
}

/** TEST-ONLY: clear the in-memory buffer. No effect on Redis. */
export function __resetRouterDecisionMemBuffer(): void {
  memBuffer.length = 0;
}
