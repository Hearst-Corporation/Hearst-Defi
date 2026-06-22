/**
 * Tests for the dev-only concurrency guard (assertDevConcurrencyGuard).
 *
 * This guard is the dev-side burst protection that stands in for the sliding-
 * window rate limiter (which is bypassed when NODE_ENV=development). It is
 * opt-in via DEV_CHAT_CONCURRENCY and is a strict NO-OP in production, so prod
 * behaviour is unchanged. We exercise:
 *   - disabled by default (no env var) → unlimited, no throw
 *   - inert in production even when the var is set
 *   - caps concurrent in-flight slots once enabled
 *   - releasing a slot frees capacity for the next acquire
 *   - idempotent release (double-release never under-counts)
 *   - per-identifier isolation
 */

import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "file:./prisma/dev.db",
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
    LOG_LEVEL: "error",
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => {
    throw new Error("Redis should not be instantiated in unit tests");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { assertDevConcurrencyGuard } from "@/lib/rate-limit";

// Default to a non-prod env for the suite; individual tests stub as needed.
beforeAll(() => {
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  // Restore the non-prod default consumed by the next test's beforeAll-less run.
  vi.stubEnv("NODE_ENV", "test");
});

let counter = 0;
function uid(): string {
  return `dev-cc-${++counter}`;
}

describe("assertDevConcurrencyGuard", () => {
  it("is a no-op (no cap) when DEV_CHAT_CONCURRENCY is unset", () => {
    const id = uid();
    const releases = Array.from({ length: 50 }, () =>
      assertDevConcurrencyGuard(id),
    );
    // No throw for any acquire, even far past any plausible cap.
    expect(releases).toHaveLength(50);
    releases.forEach((r) => r());
  });

  it("is inert in production even when DEV_CHAT_CONCURRENCY is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "1");
    const id = uid();
    // Two simultaneous acquires would trip a cap of 1 — but prod ignores the var.
    const r1 = assertDevConcurrencyGuard(id);
    expect(() => assertDevConcurrencyGuard(id)).not.toThrow();
    r1();
  });

  it("ignores a non-positive / malformed cap", () => {
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "0");
    const id = uid();
    expect(() => {
      for (let i = 0; i < 10; i++) assertDevConcurrencyGuard(id);
    }).not.toThrow();

    vi.stubEnv("DEV_CHAT_CONCURRENCY", "not-a-number");
    const id2 = uid();
    expect(() => {
      for (let i = 0; i < 10; i++) assertDevConcurrencyGuard(id2);
    }).not.toThrow();
  });

  it("caps concurrent in-flight acquires at the configured value", () => {
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "2");
    const id = uid();
    const r1 = assertDevConcurrencyGuard(id);
    const r2 = assertDevConcurrencyGuard(id);
    // Third concurrent acquire exceeds the cap of 2 → throws (→ 429 at route).
    expect(() => assertDevConcurrencyGuard(id)).toThrow(
      /Too many concurrent requests/,
    );
    r1();
    r2();
  });

  it("frees capacity once a slot is released", () => {
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "1");
    const id = uid();
    const r1 = assertDevConcurrencyGuard(id);
    expect(() => assertDevConcurrencyGuard(id)).toThrow();
    r1(); // release the only slot
    // Now a fresh acquire succeeds.
    const r2 = assertDevConcurrencyGuard(id);
    expect(typeof r2).toBe("function");
    r2();
  });

  it("release is idempotent — a double release never under-counts", () => {
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "1");
    const id = uid();
    const r1 = assertDevConcurrencyGuard(id);
    r1();
    r1(); // second release must be a no-op, not free a phantom extra slot
    // Capacity is exactly 1: one acquire OK, the next concurrent one throws.
    const r2 = assertDevConcurrencyGuard(id);
    expect(() => assertDevConcurrencyGuard(id)).toThrow();
    r2();
  });

  it("tracks separate in-flight counts per identifier", () => {
    vi.stubEnv("DEV_CHAT_CONCURRENCY", "1");
    const idA = uid();
    const idB = uid();
    const rA = assertDevConcurrencyGuard(idA);
    // A is saturated; B has its own independent slot.
    expect(() => assertDevConcurrencyGuard(idA)).toThrow();
    const rB = assertDevConcurrencyGuard(idB);
    expect(typeof rB).toBe("function");
    rA();
    rB();
  });
});
