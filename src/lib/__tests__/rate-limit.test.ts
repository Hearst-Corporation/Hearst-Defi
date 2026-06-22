/**
 * Tests for the in-memory fallback path of the rate limiter.
 *
 * We mock @upstash/redis so that no Redis client is ever constructed,
 * forcing the module to use its in-memory Map backend throughout.
 *
 * We also stub the `env` module to ensure UPSTASH_REDIS_REST_URL is always
 * undefined in this test file, regardless of what the CI environment has set.
 */

import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

// ── Hoist mocks before any module import ──────────────────────────────────

// Force env to never have Redis credentials so getRedis() returns null.
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "file:./prisma/dev.db",
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
    LOG_LEVEL: "error",
  },
}));

// isRateLimitBypassed() short-circuits on NODE_ENV=development. Force test mode
// so the in-memory path is exercised instead of the bypass.
beforeAll(() => { vi.stubEnv("NODE_ENV", "test"); });
afterAll(() => { vi.unstubAllEnvs(); });

// Stub out @upstash/redis entirely — it should never be instantiated here.
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => {
    throw new Error("Redis should not be instantiated in unit tests");
  }),
}));

// Stub the logger so we don't get JSON noise in test output.
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { assertRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function uid(): string {
  return `test-rl-${++counter}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assertRateLimit — in-memory fallback (no Redis)", () => {
  it("does not throw for the first request", async () => {
    await expect(assertRateLimit(uid(), 5, 60_000)).resolves.toBeUndefined();
  });

  it("does not throw for up to maxRequests in a window", async () => {
    const id = uid();
    const max = 3;
    for (let i = 0; i < max; i++) {
      await expect(assertRateLimit(id, max, 60_000)).resolves.toBeUndefined();
    }
  });

  it("throws on the (maxRequests + 1)th request within the window", async () => {
    const id = uid();
    const max = 2;
    for (let i = 0; i < max; i++) {
      await assertRateLimit(id, max, 60_000);
    }
    await expect(assertRateLimit(id, max, 60_000)).rejects.toThrow(
      /Rate limit exceeded/,
    );
  });

  it("error message includes a retry-after hint", async () => {
    const id = uid();
    const max = 1;
    await assertRateLimit(id, max, 60_000); // consume the only slot
    await expect(assertRateLimit(id, max, 60_000)).rejects.toThrow(/Try again in/);
  });

  it("resets after the window expires (short window)", async () => {
    const id = uid();
    const max = 1;
    const windowMs = 80; // 80 ms — expires fast

    await assertRateLimit(id, max, windowMs);
    // Immediately over limit
    await expect(assertRateLimit(id, max, windowMs)).rejects.toThrow(
      /Rate limit exceeded/,
    );

    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, windowMs + 30));

    // New window — should succeed
    await expect(assertRateLimit(id, max, windowMs)).resolves.toBeUndefined();
  });

  it("tracks separate buckets for different identifiers", async () => {
    const idA = uid();
    const idB = uid();
    const max = 1;

    await assertRateLimit(idA, max, 60_000);
    // A is exhausted; B has its own fresh bucket
    await expect(assertRateLimit(idA, max, 60_000)).rejects.toThrow();
    await expect(assertRateLimit(idB, max, 60_000)).resolves.toBeUndefined();
  });

  it("uses default limit of 10 when no params are passed", async () => {
    const id = uid();
    // Make 10 requests — all should succeed (default max = 10)
    for (let i = 0; i < 10; i++) {
      await expect(assertRateLimit(id)).resolves.toBeUndefined();
    }
    // 11th should fail
    await expect(assertRateLimit(id)).rejects.toThrow(/Rate limit exceeded/);
  });
});
