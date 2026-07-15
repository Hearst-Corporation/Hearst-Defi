/**
 * Integration tests for GET /api/strategies/[index].
 *
 * The chain adapter's READERS, auth, rate-limit and logger are mocked, so the
 * suite runs with no RPC, no Redis and no session. The adapter's constants stay
 * real via `importOriginal` -- a hand-stubbed copy would drift silently.
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
    // NOTE: there is no `readStrategyCount` on the adapter. The count is
    // `readStrategies().data.length` -- and that same read already carries the
    // row this route serves.
    readStrategies: vi.fn(),
  };
});

import { GET } from "@/app/api/strategies/[index]/route";
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
const ADAPTER_0: Address = "0x1111111111111111111111111111111111111111";
const ADAPTER_1: Address = "0x2222222222222222222222222222222222222222";
const ADAPTER_2: Address = "0x3333333333333333333333333333333333333333";
const READ_AT = "2026-07-15T10:00:00.000Z";
const CHAIN_ID = 84532;

/** Three strategies -> valid indices are 0..2; 3 must be a 404. */
const STRATEGIES: StrategyInfo[] = [
  { index: 0, adapter: ADAPTER_0, allocationBps: 4_500n, enabled: true, isIdle: true },
  { index: 1, adapter: ADAPTER_1, allocationBps: 3_500n, enabled: true, isIdle: false },
  { index: 2, adapter: ADAPTER_2, allocationBps: 2_000n, enabled: false, isIdle: false },
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

function call(index: string) {
  return GET(new Request(`http://localhost/api/strategies/${index}`), {
    params: Promise.resolve({ index }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "u1" });
  mockRateLimit.mockResolvedValue(undefined);
  mockMode.mockReturnValue("v2");
  mockStrategies.mockResolvedValue(ok(STRATEGIES));
});

describe("GET /api/strategies/[index] -- auth", () => {
  it("401s before reading the chain when unauthenticated", async () => {
    mockAuth.mockRejectedValue(new Error("Authentication required."));

    const res = await call("0");

    expect(res.status).toBe(401);
    expect(mockStrategies).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without reading the chain", async () => {
    mockRateLimit.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 30s."),
    );

    const res = await call("0");

    expect(res.status).toBe(429);
    expect(mockStrategies).not.toHaveBeenCalled();
  });
});

describe("GET /api/strategies/[index] -- param validation", () => {
  it.each([
    ["abc", "non-numeric"],
    ["-1", "negative"],
    ["1.5", "fractional"],
    ["1e3", "exponent"],
    [" 1", "padded"],
    ["0x0", "hex"],
    ["", 'empty -- Number("") is 0, which must NOT pass as index 0'],
    ["99999", "beyond the syntactic ceiling"],
  ])("400s on %s (%s) without touching the chain", async (raw) => {
    const res = await call(raw);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid strategy index" });
    expect(mockStrategies).not.toHaveBeenCalled();
  });

  it("404s when the index is past the on-chain count", async () => {
    // count is 3 -> valid indices are 0..2. The request is well-formed; the
    // resource simply does not exist. That is a 404, not a 400.
    const res = await call("3");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Strategy not found" });
  });

  it("bounds against the REAL count, not a hardcoded one", async () => {
    mockStrategies.mockResolvedValue(ok(STRATEGIES.slice(0, 1)));

    // Index 2 exists in the default fixture but not in this one-strategy vault.
    expect((await call("2")).status).toBe(404);
    expect((await call("0")).status).toBe(200);
  });

  it("accepts the last valid index", async () => {
    const res = await call("2");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.index).toBe(2);
    expect(body.strategy.data.index).toBe(2);
    expect(body.strategy.data.adapter).toBe(ADAPTER_2);
  });
});

describe("GET /api/strategies/[index] -- payload", () => {
  it("returns the strategy with bigints stringified and envelope intact", async () => {
    const body = await (await call("0")).json();

    expect(body.mode).toBe("v2");
    expect(body.index).toBe(0);
    expect(body.strategy).toEqual({
      status: "wired",
      data: {
        index: 0,
        adapter: ADAPTER_0,
        allocationBps: "4500",
        enabled: true,
        isIdle: true,
      },
      source: "v2",
      address: ADDRESS,
      chainId: CHAIN_ID,
      readAt: READ_AT,
    });
  });

  it("reads the chain exactly once -- the count read already carries the row", async () => {
    await call("1");

    expect(mockStrategies).toHaveBeenCalledTimes(1);
  });

  it("serves the requested row, not the first one", async () => {
    const body = await (await call("1")).json();

    expect(body.strategy.data).toEqual({
      index: 1,
      adapter: ADAPTER_1,
      allocationBps: "3500",
      enabled: true,
      isIdle: false,
    });
  });

  it("never fabricates assets or isIdle", async () => {
    const body = await (await call("2")).json();

    expect(body.assets.status).toBe("unavailable");
    expect(body.assets.reason).toBe("not_exposed_by_contract");
    expect(body.isIdle.status).toBe("unavailable");
    expect(body.isIdle.reason).toBe("not_exposed_by_contract");
    // Strategy 2 is `enabled: false`. isIdle must NOT be silently derived from
    // that unconfirmed flag, however tempting.
    expect(body.strategy.data.enabled).toBe(false);
    expect(body.isIdle).not.toHaveProperty("data");
  });
});

describe("GET /api/strategies/[index] -- honesty", () => {
  it("propagates the motive and does not 404 when the bound is unknown", async () => {
    mockStrategies.mockResolvedValue({
      status: "unavailable",
      reason: "rpc_error",
      detail: "timeout",
    });

    const res = await call("0");
    const body = await res.json();

    // Neither 400 nor 404: the caller's input is fine, the chain read failed.
    // A 404 here would assert the strategy does not exist -- we cannot know.
    expect(res.status).toBe(200);
    expect(body.strategy.status).toBe("unavailable");
    expect(body.strategy.reason).toBe("rpc_error");
    expect(body.strategy.detail).toBe("timeout");
    expect(body.strategy).not.toHaveProperty("data");
  });

  it("keeps an RPC outage distinct from a strategy that does not exist", async () => {
    mockStrategies.mockResolvedValue({ status: "unavailable", reason: "rpc_error" });
    const outage = await call("9");

    mockStrategies.mockResolvedValue(ok(STRATEGIES));
    const missing = await call("9");

    // Same index, two different truths -- they must not answer the same thing.
    expect(outage.status).toBe(200);
    expect((await outage.json()).strategy.reason).toBe("rpc_error");
    expect(missing.status).toBe(404);
  });

  it("reports not_supported_by_legacy in legacy mode", async () => {
    mockMode.mockReturnValue("legacy");
    mockStrategies.mockResolvedValue({
      status: "unavailable",
      reason: "not_supported_by_legacy",
    });

    const body = await (await call("0")).json();

    expect(body.mode).toBe("legacy");
    expect(body.strategy.reason).toBe("not_supported_by_legacy");
    expect(body.assets.reason).toBe("not_supported_by_legacy");
    expect(body.isIdle.reason).toBe("not_supported_by_legacy");
  });

  it("reports not_deployed when nothing is configured", async () => {
    mockMode.mockReturnValue("not_configured");
    mockStrategies.mockResolvedValue({
      status: "unavailable",
      reason: "not_deployed",
    });

    const body = await (await call("0")).json();

    expect(body.mode).toBe("not_configured");
    expect(body.strategy.reason).toBe("not_deployed");
  });

  it("500s generically and never leaks the error message", async () => {
    mockStrategies.mockRejectedValue(new Error("boom at 10.0.0.1"));

    const res = await call("0");
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
