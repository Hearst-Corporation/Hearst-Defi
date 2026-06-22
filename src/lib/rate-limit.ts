import "server-only";

import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Maximum request body size for API routes (1 MB). */
export const MAX_BODY_SIZE_BYTES = 1024 * 1024;

/**
 * Assert that the request body is within the size limit.
 * Call this BEFORE `req.json()` to prevent memory exhaustion from oversized payloads.
 * Throws a clear error if the Content-Length header exceeds the limit.
 */
export async function assertBodySize(req: NextRequest): Promise<void> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isNaN(size) && size > MAX_BODY_SIZE_BYTES) {
      throw new Error(
        `Request body too large. Max ${MAX_BODY_SIZE_BYTES} bytes (${MAX_BODY_SIZE_BYTES / 1024 / 1024} MB).`,
      );
    }
  }
  // If no Content-Length is present, we proceed and let req.json() handle it.
  // Vercel has its own ~4.5MB limit at the infrastructure level.
}

/**
 * Sliding-window rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is configured,
 * otherwise falls back to an in-memory Map (single-instance only).
 *
 * Default: 10 requests per 60-second window per identifier.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;

function nowMs(): number {
  return Date.now();
}

/* -------------------------------------------------------------------------- */
/* Redis backend (multi-instance safe)                                       */
/* -------------------------------------------------------------------------- */

let redis: Redis | null = null;

/** Exported for health-check usage. Returns null when Redis is not configured. */
export function getRedis(): Redis | null {
  if (redis) return redis;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Atomic Lua script for the sliding-window rate limiter (AUTH-5).
 *
 * Eliminates the TOCTOU race where concurrent callers each read a count below
 * the cap before any write lands, then all insert and exceed the limit.
 *
 * All five operations execute in a single server-side round-trip under Redis's
 * sequential-script guarantee (no interleaving from other clients):
 *   1. ZREMRANGEBYSCORE  — prune entries older than the window
 *   2. ZCARD             — count entries currently in window
 *   3. Conditional ZADD  — add this request only if count < limit
 *   4. PEXPIRE           — refresh the key TTL (only on the success branch)
 *   5. Return [allowed(0|1), count_after_prune, oldest_score_or_0]
 *
 * KEYS[1]  = the rate-limit key
 * ARGV[1]  = now (ms, integer string)
 * ARGV[2]  = windowStart = now - windowMs  (ms, integer string)
 * ARGV[3]  = maxRequests
 * ARGV[4]  = member = unique string for this call ("now:rand")
 * ARGV[5]  = windowMs (ms, integer string)  — used for PEXPIRE
 *
 * Returns a three-element array:
 *   [0] allowed  — 1 if the request is permitted, 0 if rate-limited
 *   [1] count    — number of entries in window AFTER pruning (before insert)
 *   [2] oldest   — score of the oldest entry in window (0 when set is empty)
 */
const SLIDING_WINDOW_LUA = `
local key         = KEYS[1]
local now         = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local maxReq      = tonumber(ARGV[3])
local member      = ARGV[4]
local windowMs    = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local count = redis.call('ZCARD', key)

if count < maxReq then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, windowMs + 1000)
  return {1, count, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = 0
if #oldest > 0 then
  oldestScore = tonumber(oldest[2])
end
return {0, count, oldestScore}
`.trim();

async function checkRedis(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) {
    return { success: true, limit: maxRequests, remaining: maxRequests - 1, resetAt: nowMs() + windowMs };
  }

  const now = nowMs();
  const windowStart = now - windowMs;
  // Unique member: millisecond timestamp + random suffix prevents collision when
  // two callers arrive within the same millisecond.
  const member = `${now}:${Math.random()}`;

  // Single atomic round-trip — no TOCTOU between count and insert (AUTH-5).
  const raw = await client.eval(
    SLIDING_WINDOW_LUA,
    [key],
    [String(now), String(windowStart), String(maxRequests), member, String(windowMs)],
  ) as [unknown, unknown, unknown];

  // Upstash REST eval can return numeric Lua values as strings; coerce at the
  // boundary so downstream arithmetic is always numeric (AUTH-5 fix).
  const allowed = Number(raw[0]);
  const count = Number(raw[1]);
  const rawOldest = Number(raw[2]);
  // Guard against NaN (e.g. Redis returned null/undefined for oldest score):
  // treat it as "no prior entry" so resetAt falls back to now + windowMs.
  const oldestScore = Number.isNaN(rawOldest) ? 0 : rawOldest;

  if (allowed === 1) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - count - 1,
      resetAt: now + windowMs,
    };
  }

  const resetAt = oldestScore > 0 ? oldestScore + windowMs : now + windowMs;
  return { success: false, limit: maxRequests, remaining: 0, resetAt };
}

/* -------------------------------------------------------------------------- */
/* In-memory backend (single-instance fallback)                              */
/* -------------------------------------------------------------------------- */

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Bucket>();

function getMemoryBucket(key: string, windowMs: number): Bucket {
  const existing = memoryStore.get(key);
  if (existing && existing.resetAt > nowMs()) {
    return existing;
  }
  const fresh: Bucket = { count: 0, resetAt: nowMs() + windowMs };
  memoryStore.set(key, fresh);
  return fresh;
}

function checkMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const bucket = getMemoryBucket(key, windowMs);
  const remaining = Math.max(0, maxRequests - bucket.count);
  const success = remaining > 0;

  if (success) {
    bucket.count += 1;
  }

  return {
    success,
    limit: maxRequests,
    remaining: success ? remaining - 1 : 0,
    resetAt: bucket.resetAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * True when rate limiting should be skipped (local dev / E2E / explicit opt-out).
 * Production always enforces limits.
 */
export function isRateLimitBypassed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.DISABLE_RATE_LIMIT === "1") return true;
  if (process.env.E2E_DISABLE_RATE_LIMIT === "1") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

async function checkRateLimit(
  identifier: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
  if (isRateLimitBypassed()) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetAt: nowMs() + windowMs,
    };
  }
  const redisClient = getRedis();
  if (redisClient) {
    return checkRedis(identifier, maxRequests, windowMs);
  }
  return checkMemory(identifier, maxRequests, windowMs);
}

/**
 * Assert-style helper: throws a clear error when the limit is exceeded.
 */
export async function assertRateLimit(
  identifier: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<void> {
  const result = await checkRateLimit(identifier, maxRequests, windowMs);
  if (!result.success) {
    const retryAfterSec = Math.ceil((result.resetAt - nowMs()) / 1000);
    logger.warn("rate limit exceeded", { identifier, retryAfterSec });
    throw new Error(`Rate limit exceeded. Try again in ${retryAfterSec}s.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Dev-only concurrency guard (NOT a prod path)                              */
/* -------------------------------------------------------------------------- */

/**
 * The sliding-window rate limiter above is bypassed in dev (`isRateLimitBypassed`
 * returns true for NODE_ENV=development), so a local burst (e.g. 30 cockpit-chat
 * POSTs fired back-to-back) has NO ceiling: each request fans out ~10 Prisma
 * queries + an LLM round-trip and they all run *concurrently*, exhausting the
 * dev Prisma pool (`max: 8`) and piling up in-flight LLM/stream work until the
 * Node dev server OOM-crashes.
 *
 * This is a separate, OPT-IN, single-process concurrency CAP — distinct from the
 * request/window rate limiter. It bounds how many requests for a given key may
 * be IN FLIGHT at once (it does not count requests over time, it counts active
 * ones). It is intentionally inert unless BOTH conditions hold:
 *   - we are NOT in production (`NODE_ENV !== "production"`), and
 *   - `DEV_CHAT_CONCURRENCY` is set to a positive integer.
 * Production never sets that var, so `assertDevConcurrencyGuard` is a no-op there
 * and prod behaviour is unchanged (the Upstash sliding window remains the only
 * gate). It is also process-local by design: it protects the single dev server,
 * not a multi-instance deployment.
 */
const devInFlight = new Map<string, number>();

/** Parse `DEV_CHAT_CONCURRENCY` → a positive cap, or null when disabled. */
function devConcurrencyCap(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.DEV_CHAT_CONCURRENCY;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Acquire a dev concurrency slot for `identifier`. Returns a `release()` that
 * MUST be called (in a `finally`) once the request's work is done. When the guard
 * is disabled (prod, or `DEV_CHAT_CONCURRENCY` unset) it is a no-op that always
 * succeeds with a no-op release — so callers can wire it unconditionally without
 * branching on the environment.
 *
 * Throws when the cap is already reached, mirroring `assertRateLimit`'s
 * throw-on-reject contract so the route maps it to a 429 the same way.
 */
export function assertDevConcurrencyGuard(identifier: string): () => void {
  const cap = devConcurrencyCap();
  if (cap === null) return () => {};

  const active = devInFlight.get(identifier) ?? 0;
  if (active >= cap) {
    logger.warn("dev concurrency guard tripped", { identifier, active, cap });
    throw new Error(
      `Too many concurrent requests in dev (cap ${cap}). Try again in a moment.`,
    );
  }
  devInFlight.set(identifier, active + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = devInFlight.get(identifier) ?? 1;
    if (current <= 1) devInFlight.delete(identifier);
    else devInFlight.set(identifier, current - 1);
  };
}
