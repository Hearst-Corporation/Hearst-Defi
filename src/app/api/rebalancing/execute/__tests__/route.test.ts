import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { RebalanceResult } from "@/lib/chain/keeper";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/admin/audit", () => ({ recordAdminAudit: vi.fn() }));
vi.mock("@/lib/chain/keeper", () => ({
  isKeeperEnabled: vi.fn(),
  executeRebalance: vi.fn(),
}));

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { executeRebalance, isKeeperEnabled } from "@/lib/chain/keeper";
import { assertRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/rebalancing/execute/route";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockIsKeeperEnabled = vi.mocked(isKeeperEnabled);
const mockExecute = vi.mocked(executeRebalance);
const mockAudit = vi.mocked(recordAdminAudit);
const mockRateLimit = vi.mocked(assertRateLimit);

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const VAULT = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
const ROUTER = "0x1111111111111111111111111111111111111111";
const SWAP_TX = "0xabababababababababababababababababababababababababababababababab";
const REB_TX = "0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
const WORD = "0xefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef";

const VALID_BODY = {
  tokenIn: USDC,
  tokenOut: VAULT,
  amountIn: "1000000",
  minAmountOut: "990000",
  router: ROUTER,
  swapData: [WORD],
};

const SENT: RebalanceResult = {
  status: "sent",
  swapTxHash: SWAP_TX,
  rebalanceTxHash: REB_TX,
  address: VAULT,
  chainId: 84532,
  sentAt: "2026-07-15T00:00:00.000Z",
};

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/rebalancing/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin_1", walletAddress: "0xadmin" });
  mockRateLimit.mockResolvedValue(undefined);
  mockIsKeeperEnabled.mockReturnValue(true);
  mockExecute.mockResolvedValue(SENT);
  mockAudit.mockResolvedValue(undefined);
});

describe("POST /api/rebalancing/execute — human-approved only (ADR-006)", () => {
  it("returns 401 when unauthenticated and swaps nothing", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin and swaps nothing", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("POST /api/rebalancing/execute — kill-switch", () => {
  it("returns 503 keeper_disabled by default", async () => {
    mockIsKeeperEnabled.mockReturnValue(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "keeper_disabled" });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("POST /api/rebalancing/execute — body validation", () => {
  const INVALID_BODIES: Array<[string, unknown]> = [
    ["empty body", {}],
    ["null", null],
    ["bad tokenIn", { ...VALID_BODY, tokenIn: "0xnope" }],
    ["bad router", { ...VALID_BODY, router: "not-an-address" }],
    ["tokenIn === tokenOut", { ...VALID_BODY, tokenOut: USDC }],
    ["amountIn as a number, not a string", { ...VALID_BODY, amountIn: 1000000 }],
    ["amountIn zero", { ...VALID_BODY, amountIn: "0" }],
    ["amountIn negative", { ...VALID_BODY, amountIn: "-1" }],
    ["amountIn fractional", { ...VALID_BODY, amountIn: "1.5" }],
    ["amountIn in scientific notation", { ...VALID_BODY, amountIn: "1e6" }],
    ["amountIn hex", { ...VALID_BODY, amountIn: "0x10" }],
    ["amountIn with a leading zero", { ...VALID_BODY, amountIn: "007" }],
    ["amountIn non-numeric", { ...VALID_BODY, amountIn: "abc" }],
    ["minAmountOut negative", { ...VALID_BODY, minAmountOut: "-1" }],
    ["swapData word too short", { ...VALID_BODY, swapData: ["0xdead"] }],
    ["swapData not an array", { ...VALID_BODY, swapData: WORD }],
    ["unknown key", { ...VALID_BODY, receiver: "0xdead" }],
  ];

  it.each(INVALID_BODIES)("returns 400 for %s and never swaps", async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for an amountIn past uint256 rather than throwing", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, amountIn: (2n ** 256n).toString() }),
    );
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns 400 for an absurdly long digit string without ever calling BigInt on it", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, amountIn: "9".repeat(5000) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized swapData", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, swapData: Array.from({ length: 65 }, () => WORD) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON rather than a 500", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/rebalancing/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts uint256 max and an empty swapData", async () => {
    const res = await POST(
      makeRequest({
        ...VALID_BODY,
        amountIn: (2n ** 256n - 1n).toString(),
        minAmountOut: "0",
        swapData: [],
      }),
    );
    expect(res.status).toBe(200);
  });

  it("converts base-unit strings to bigint — never through a Number", async () => {
    // 2^53+1: the first integer a double cannot represent. If this ever arrives
    // at the keeper as 9007199254740992n, the string→bigint path has regressed.
    const beyondDouble = "9007199254740993";
    await POST(makeRequest({ ...VALID_BODY, amountIn: beyondDouble }));
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ amountIn: 9007199254740993n }),
    );
  });

  it("passes the validated addresses and swapData through unchanged", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockExecute).toHaveBeenCalledWith({
      tokenIn: USDC,
      tokenOut: VAULT,
      amountIn: 1000000n,
      minAmountOut: 990000n,
      router: ROUTER,
      swapData: [WORD],
    });
  });
});

describe("POST /api/rebalancing/execute — the non-atomic sequence is reported honestly", () => {
  it("returns 503 not_deployed and attempts nothing", async () => {
    mockExecute.mockResolvedValue({ status: "blocked", reason: "not_deployed" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "not_deployed" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 422 swap_reverted WITH the tx hash, and audits it", async () => {
    mockExecute.mockResolvedValue({
      status: "swap_reverted",
      swapTxHash: SWAP_TX,
      address: VAULT,
      chainId: 84532,
      sentAt: "2026-07-15T00:00:00.000Z",
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      reason: "swap_reverted",
      swapTxHash: SWAP_TX,
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ outcome: "swap_reverted", swapTxHash: SWAP_TX }),
      }),
    );
  });

  it("returns 502 rebalance_failed WITH the swap hash — the vault is mid-sequence", async () => {
    mockExecute.mockResolvedValue({
      status: "rebalance_failed",
      swapTxHash: SWAP_TX,
      reason: "rpc_error",
      detail: "ETIMEDOUT",
      address: VAULT,
      chainId: 84532,
      sentAt: "2026-07-15T00:00:00.000Z",
    });
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({ reason: "rebalance_failed", swapTxHash: SWAP_TX });
    // The swap MOVED FUNDS. It must be audited even though the request failed.
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          outcome: "rebalance_failed",
          swapTxHash: SWAP_TX,
        }),
      }),
    );
    // ...and the internal detail still must not reach the client.
    expect(JSON.stringify(body)).not.toContain("ETIMEDOUT");
  });
});

describe("POST /api/rebalancing/execute — success", () => {
  it("returns 200 with both tx hashes", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      status: "sent",
      swapTxHash: SWAP_TX,
      rebalanceTxHash: REB_TX,
    });
  });

  it("audits both transactions and the requested route", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorWallet: "0xadmin",
        action: "keeper.executeRebalance",
        entityType: "DynaVaultKeeper",
        entityId: VAULT,
        after: expect.objectContaining({
          outcome: "sent",
          swapTxHash: SWAP_TX,
          rebalanceTxHash: REB_TX,
          tokenIn: USDC,
          amountIn: "1000000",
        }),
      }),
    );
  });
});
