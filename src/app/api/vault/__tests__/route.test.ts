/**
 * Integration tests for GET /api/vault.
 *
 * The chain adapter's READERS, auth, rate-limit and logger are mocked, so the
 * suite runs with no RPC, no Redis and no session. The adapter's CONSTANTS
 * (UNAVAILABLE_REASONS) are kept real via `importOriginal`: the route compares
 * against them, and a hand-stubbed copy would let a renamed reason pass here
 * while breaking in production.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Address } from "viem";

import type { VaultCore } from "@/lib/chain/dynavault";
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
    // NOTE: there is no `readTvlCap` on the adapter and there must not be one --
    // `tvlCap` is a field of VaultCore, returned by this single read.
    readVaultCore: vi.fn(),
  };
});

import { GET } from "@/app/api/vault/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getVaultMode, readVaultCore } from "@/lib/chain/dynavault";
import { assertRateLimit } from "@/lib/rate-limit";

const mockAuth = vi.mocked(requireAuth);
const mockCore = vi.mocked(readVaultCore);
const mockMode = vi.mocked(getVaultMode);
const mockRateLimit = vi.mocked(assertRateLimit);

// Annotated, not cast: a `0x`-prefixed string literal is assignable to viem's
// `Address` (`0x${string}`) on sight. No `as any`, no `as unknown as`.
const ADDRESS: Address = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
/** USDC on Base Sepolia -- the vault's asset (settled: USDC, never USDT). */
const USDC: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const READ_AT = "2026-07-15T10:00:00.000Z";
const CHAIN_ID = 84532;

function ok<T>(
  data: T,
  overrides: { readAt?: string; source?: "v2" | "legacy" } = {},
): WiredOk<T> {
  return {
    status: "wired",
    data,
    source: overrides.source ?? "v2",
    address: ADDRESS,
    chainId: CHAIN_ID,
    readAt: overrides.readAt ?? READ_AT,
  };
}

/**
 * A COMPLETE VaultCore -- all 8 fields. Mirrors the real on-chain state
 * (totalAssets()=12 USDC, totalSupply()=12e18, convertToAssets(1e18)=1.000000)
 * with a 100 USDC cap. `paused: null` is v2's truth: the v2.1 spec lists no
 * `paused()` view, and null means "not exposed", never "not paused".
 */
const V2_CORE: VaultCore = {
  totalAssets: 12_000_000n,
  totalShares: 12n * 10n ** 18n,
  navPerShare: 1_000_000n,
  asset: USDC,
  assetDecimals: 6,
  shareDecimals: 18,
  tvlCap: 100_000_000n,
  paused: null,
};

/** Legacy: no cap at all (tvlCap null, NOT 0n), but `paused()` is real. */
const LEGACY_CORE: VaultCore = { ...V2_CORE, tvlCap: null, paused: false };

const V2_CORE_JSON = {
  totalAssets: "12000000",
  totalShares: "12000000000000000000",
  navPerShare: "1000000",
  asset: USDC,
  assetDecimals: 6,
  shareDecimals: 18,
  tvlCap: "100000000",
  paused: null,
};

function setUp(): void {
  mockAuth.mockResolvedValue({ userId: "u1" });
  mockRateLimit.mockResolvedValue(undefined);
  mockMode.mockReturnValue("v2");
  mockCore.mockResolvedValue(ok(V2_CORE));
}

beforeEach(() => {
  vi.clearAllMocks();
  setUp();
});

describe("GET /api/vault -- auth gate", () => {
  it("401s before any chain read when there is no session", async () => {
    mockAuth.mockRejectedValue(new Error("Authentication required."));

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockCore).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without reading the chain", async () => {
    mockRateLimit.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 30s."),
    );

    const res = await GET();

    expect(res.status).toBe(429);
    expect(mockCore).not.toHaveBeenCalled();
  });
});

describe("GET /api/vault -- payload", () => {
  it("serializes uint256 as strings and keeps the envelope", async () => {
    const body = await (await GET()).json();

    expect(body.mode).toBe("v2");
    expect(body.core).toEqual({
      status: "wired",
      data: V2_CORE_JSON,
      source: "v2",
      address: ADDRESS,
      chainId: CHAIN_ID,
      readAt: READ_AT,
    });
  });

  it("keeps a share balance above 2^53 lossless as a decimal string", async () => {
    const body = await (await GET()).json();

    // Number(12e18) would round. The string must survive character for
    // character -- a silently wrong TVL is exactly what this guards.
    expect(body.core.data.totalShares).toBe("12000000000000000000");
    expect(BigInt(body.core.data.totalShares)).toBe(12n * 10n ** 18n);
  });

  it("serves tvlCap out of the core read, envelope and all", async () => {
    const body = await (await GET()).json();

    expect(body.tvlCap).toEqual({
      status: "wired",
      data: "100000000",
      source: "v2",
      address: ADDRESS,
      chainId: CHAIN_ID,
      readAt: READ_AT,
    });
  });

  it("reads the chain exactly once -- tvlCap needs no second round trip", async () => {
    await GET();

    // Two reads would divide a totalAssets from t0 by a cap from t1.
    expect(mockCore).toHaveBeenCalledTimes(1);
  });

  it("computes utilization in bps (12 USDC of a 100 USDC cap = 12% = 1200 bps)", async () => {
    const body = await (await GET()).json();

    expect(body.utilization.status).toBe("wired");
    expect(body.utilization.data).toEqual({ bps: 1_200 });
  });

  it("does not clamp utilization above 100% -- over-cap must stay visible", async () => {
    mockCore.mockResolvedValue(ok({ ...V2_CORE, totalAssets: 150_000_000n }));

    const body = await (await GET()).json();

    expect(body.utilization.data).toEqual({ bps: 15_000 });
  });

  it("stamps utilization with the read it was derived from", async () => {
    const older = "2026-07-15T09:00:00.000Z";
    mockCore.mockResolvedValue(ok(V2_CORE, { readAt: older }));

    const body = await (await GET()).json();

    expect(body.utilization.readAt).toBe(older);
    expect(body.tvlCap.readAt).toBe(older);
  });
});

describe("GET /api/vault -- honesty", () => {
  it("reports utilization unavailable (not 0%) when tvlCap is really 0 on-chain", async () => {
    mockCore.mockResolvedValue(ok({ ...V2_CORE, tvlCap: 0n }));

    const body = await (await GET()).json();

    // The cap read SUCCEEDED and the answer is 0 -- that is reported as read.
    expect(body.tvlCap.status).toBe("wired");
    expect(body.tvlCap.data).toBe("0");
    // Utilization, however, is undefined by it -- never 0%, never 100%.
    expect(body.utilization.status).toBe("unavailable");
    expect(body.utilization.reason).toBe("tvl_cap_zero");
    expect(body.utilization).not.toHaveProperty("data");
  });

  it("treats a null tvlCap as NOT EXPOSED, never as zero", async () => {
    mockMode.mockReturnValue("legacy");
    mockCore.mockResolvedValue(ok(LEGACY_CORE, { source: "legacy" }));

    const body = await (await GET()).json();

    expect(body.tvlCap.status).toBe("unavailable");
    expect(body.tvlCap.reason).toBe("not_supported_by_legacy");
    expect(body.tvlCap).not.toHaveProperty("data");
    // The bug this guards: null -> 0 would make utilization Infinity/NaN, or
    // render an uncapped vault as "tvl_cap_zero" / 100% full.
    expect(body.utilization.status).toBe("unavailable");
    expect(body.utilization.reason).toBe("not_supported_by_legacy");
    expect(body.utilization.reason).not.toBe("tvl_cap_zero");
    expect(body.utilization).not.toHaveProperty("data");
  });

  it("serves totalAssets in legacy mode while tvlCap and utilization are unavailable", async () => {
    mockMode.mockReturnValue("legacy");
    mockCore.mockResolvedValue(ok(LEGACY_CORE, { source: "legacy" }));

    const body = await (await GET()).json();

    expect(body.mode).toBe("legacy");
    // The readable half is still served rather than dragged down with the cap.
    expect(body.core.status).toBe("wired");
    expect(body.core.source).toBe("legacy");
    expect(body.core.data.totalAssets).toBe("12000000");
    expect(body.core.data.tvlCap).toBeNull();
    expect(body.core.data.paused).toBe(false);
  });

  it("propagates the upstream motive so an outage stays discernible", async () => {
    mockCore.mockResolvedValue({
      status: "unavailable",
      reason: "rpc_error",
      detail: "timeout",
    });

    const body = await (await GET()).json();

    expect(body.core.reason).toBe("rpc_error");
    expect(body.tvlCap.reason).toBe("rpc_error");
    expect(body.tvlCap.detail).toBe("timeout");
    expect(body.utilization.reason).toBe("rpc_error");
    // An RPC outage must never be flattened into "the cap is absent".
    expect(body.utilization.reason).not.toBe("not_supported_by_legacy");
    expect(body.utilization.reason).not.toBe("tvl_cap_zero");
  });

  it("reports every field unavailable when nothing is configured", async () => {
    mockMode.mockReturnValue("not_configured");
    mockCore.mockResolvedValue({
      status: "unavailable",
      reason: "not_deployed",
    });

    const body = await (await GET()).json();

    expect(body.mode).toBe("not_configured");
    expect(body.core.status).toBe("unavailable");
    expect(body.core.reason).toBe("not_deployed");
    expect(body.tvlCap.reason).toBe("not_deployed");
    expect(body.utilization.reason).toBe("not_deployed");
    expect(body.core).not.toHaveProperty("data");
    expect(body.tvlCap).not.toHaveProperty("data");
    expect(body.utilization).not.toHaveProperty("data");
  });
});

describe("GET /api/vault -- errors", () => {
  it("500s generically and never leaks the error message", async () => {
    mockCore.mockRejectedValue(new Error("secret internals at 10.0.0.1"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
