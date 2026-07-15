/**
 * Integration tests for GET /api/vault/strategies.
 *
 * The chain adapter's READERS, auth, rate-limit and logger are mocked, so the
 * suite runs with no RPC, no Redis and no session.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Address } from "viem";

import type { StrategyInfo } from "@/lib/chain/dynavault";
import type { WiredOk } from "@/lib/chain/wired-json";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/chain/dynavault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chain/dynavault")>();
  return {
    ...actual,
    getVaultMode: vi.fn(),
    readStrategies: vi.fn(),
  };
});

import { GET } from "@/app/api/vault/strategies/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getVaultMode, readStrategies } from "@/lib/chain/dynavault";
import { assertRateLimit } from "@/lib/rate-limit";

const mockAuth = vi.mocked(requireAuth);
const mockStrategies = vi.mocked(readStrategies);
const mockMode = vi.mocked(getVaultMode);
const mockRateLimit = vi.mocked(assertRateLimit);

// Annotated, not cast: a `0x`-prefixed string literal is assignable to viem's
// `Address` (`0x${string}`) on sight. No `as any`, no `as unknown as`.
const ADDRESS: Address = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
const ADAPTER: Address = "0x1111111111111111111111111111111111111111";
const READ_AT = "2026-07-15T10:00:00.000Z";
const CHAIN_ID = 84532;

const STRATEGIES: StrategyInfo[] = [
  { index: 0, adapter: ADAPTER, allocationBps: 4_500n, enabled: true, liquid: true },
];

function ok<T>(data: T): WiredOk<T> {
  return {
    status: "wired",
    data,
    source: "v2",
    address: ADDRESS,
    chainId: CHAIN_ID,
    readAt: READ_AT,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "u1" });
  mockRateLimit.mockResolvedValue(undefined);
  mockMode.mockReturnValue("v2");
  mockStrategies.mockResolvedValue(ok(STRATEGIES));
});

describe("GET /api/vault/strategies", () => {
  it("401s before any chain read when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Authentication required."));

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockStrategies).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without reading the chain", async () => {
    mockRateLimit.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 30s."),
    );

    const res = await GET();

    expect(res.status).toBe(429);
    expect(mockStrategies).not.toHaveBeenCalled();
  });

  it("returns target allocations with bigints stringified", async () => {
    const body = await (await GET()).json();

    expect(body.strategies.status).toBe("wired");
    expect(body.strategies.data).toEqual([
      {
        index: 0,
        adapter: ADAPTER,
        allocationBps: "4500",
        enabled: true,
        liquid: true,
      },
    ]);
  });

  it("never fabricates current allocation or drift", async () => {
    const body = await (await GET()).json();

    expect(body.allocations.status).toBe("unavailable");
    expect(body.allocations.reason).toBe("not_exposed_by_contract");
    expect(body.allocations).not.toHaveProperty("data");
  });

  it("passes the adapter's legacy verdict through untouched", async () => {
    mockMode.mockReturnValue("legacy");
    mockStrategies.mockResolvedValue({
      status: "unavailable",
      reason: "not_supported_by_legacy",
    });

    const body = await (await GET()).json();

    expect(body.mode).toBe("legacy");
    expect(body.strategies.status).toBe("unavailable");
    expect(body.strategies.reason).toBe("not_supported_by_legacy");
  });

  it("keeps an RPC outage distinct from an absence of strategies", async () => {
    mockStrategies.mockResolvedValue({ status: "unavailable", reason: "rpc_error" });

    const body = await (await GET()).json();

    expect(body.strategies.reason).toBe("rpc_error");
    // An outage must NOT look like an empty strategy set.
    expect(body.strategies.data).toBeUndefined();
  });

  it("reports an empty strategy set as wired, not as an outage", async () => {
    mockStrategies.mockResolvedValue(ok<StrategyInfo[]>([]));

    const body = await (await GET()).json();

    // The mirror of the test above: a vault with zero strategies is a fact the
    // chain returned, and it must stay distinguishable from a failed read.
    expect(body.strategies.status).toBe("wired");
    expect(body.strategies.data).toEqual([]);
  });

  it("500s generically and never leaks the error message", async () => {
    mockStrategies.mockRejectedValue(new Error("boom at 10.0.0.1"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
