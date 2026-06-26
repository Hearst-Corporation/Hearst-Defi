import "server-only";

// Agentic Simulation Observability — append-only, metadata-only store.
//
// Mirrors the Router Observability v0 fallback pattern (Redis capped list +
// in-memory mirror) but DELIBERATELY uses NO durable Prisma layer: simulation
// traces must never require a migration or a business DB write. The store key is
// distinct from the router store. No user text is ever stored (the trace shape
// is metadata-only), so a single global key is privacy-safe.
//
// Every function is best-effort and NEVER throws into the simulate route.

import { getRedis } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { AgenticSimulationTrace } from "./simulation-trace";

/** Global Redis capped list key. Distinct from the router decisions key. */
export const SIMULATION_TRACES_KEY = "agentic:simulation:traces";
/** Max traces the Redis/memory store retains. */
export const SIMULATION_TRACES_CAP = 200;
/** TTL on the Redis key — 7 days. */
const SIMULATION_TRACES_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Which backend served / accepted a trace. */
export type SimulationTraceStorage = "redis" | "memory_fallback";

const globalForSim = globalThis as unknown as {
  __agenticSimulationTraces?: AgenticSimulationTrace[];
};
const memBuffer: AgenticSimulationTrace[] =
  globalForSim.__agenticSimulationTraces ??
  (globalForSim.__agenticSimulationTraces = []);

function memAppend(trace: AgenticSimulationTrace): void {
  memBuffer.unshift(trace);
  if (memBuffer.length > SIMULATION_TRACES_CAP) {
    memBuffer.length = SIMULATION_TRACES_CAP;
  }
}

async function redisAppend(trace: AgenticSimulationTrace): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.lpush(SIMULATION_TRACES_KEY, JSON.stringify(trace));
    await redis.ltrim(SIMULATION_TRACES_KEY, 0, SIMULATION_TRACES_CAP - 1);
    await redis.expire(SIMULATION_TRACES_KEY, SIMULATION_TRACES_TTL_SECONDS);
    return true;
  } catch (err) {
    logger.warn(
      "agentic-simulation-observability: Redis append failed (memory fallback)",
      {},
      err instanceof Error ? err : undefined,
    );
    return false;
  }
}

/**
 * Append a simulation trace: Redis first (capped + TTL), always mirrored to the
 * in-memory buffer so a single-instance runtime + tests can read it back.
 * Best-effort: never throws. Returns which backend durably accepted it.
 */
export async function appendSimulationTrace(
  trace: AgenticSimulationTrace,
): Promise<SimulationTraceStorage> {
  memAppend(trace);
  const redisOk = await redisAppend(trace);
  return redisOk ? "redis" : "memory_fallback";
}

/** Read recent simulation traces, newest first. Never throws. */
export async function readSimulationTraces(
  limit = SIMULATION_TRACES_CAP,
): Promise<AgenticSimulationTrace[]> {
  const bounded = Math.max(1, Math.min(limit, SIMULATION_TRACES_CAP));
  const redis = getRedis();
  if (!redis) return memBuffer.slice(0, bounded);
  try {
    const raw = await redis.lrange(SIMULATION_TRACES_KEY, 0, bounded - 1);
    return raw
      .map((entry): AgenticSimulationTrace | null => {
        if (typeof entry === "object" && entry !== null) {
          return entry as AgenticSimulationTrace;
        }
        try {
          return JSON.parse(entry as string) as AgenticSimulationTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is AgenticSimulationTrace => t !== null);
  } catch (err) {
    logger.warn(
      "agentic-simulation-observability: Redis read failed (memory fallback)",
      {},
      err instanceof Error ? err : undefined,
    );
    return memBuffer.slice(0, bounded);
  }
}

/** TEST-ONLY: clear the in-memory buffer. No effect on Redis. */
export function __resetSimulationMemBuffer(): void {
  memBuffer.length = 0;
}
