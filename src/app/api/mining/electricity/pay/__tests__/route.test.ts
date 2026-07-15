import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { KeeperTxSent } from "@/lib/chain/keeper";

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
  payElectricity: vi.fn(),
}));

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isKeeperEnabled, payElectricity } from "@/lib/chain/keeper";
import { assertRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/mining/electricity/pay/route";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockIsKeeperEnabled = vi.mocked(isKeeperEnabled);
const mockPay = vi.mocked(payElectricity);
const mockAudit = vi.mocked(recordAdminAudit);
const mockRateLimit = vi.mocked(assertRateLimit);

const VAULT = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
const TX = "0xabababababababababababababababababababababababababababababababab";

const SENT: KeeperTxSent = {
  status: "sent",
  txHash: TX,
  address: VAULT,
  chainId: 84532,
  sentAt: "2026-07-15T00:00:00.000Z",
};

/** No body at all — the normal call shape for a no-argument contract function. */
function makeRequest(body?: string): NextRequest {
  return new NextRequest("http://localhost/api/mining/electricity/pay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin_1", walletAddress: "0xadmin" });
  mockRateLimit.mockResolvedValue(undefined);
  mockIsKeeperEnabled.mockReturnValue(true);
  mockPay.mockResolvedValue(SENT);
  mockAudit.mockResolvedValue(undefined);
});

describe("POST /api/mining/electricity/pay — auth is fail-closed (this route moves funds)", () => {
  it("returns 401 when unauthenticated and moves nothing", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin and moves nothing", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited and moves nothing", async () => {
    mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded."));
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(mockPay).not.toHaveBeenCalled();
  });
});

describe("POST /api/mining/electricity/pay — kill-switch", () => {
  it("returns 503 keeper_disabled by default and moves nothing", async () => {
    mockIsKeeperEnabled.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "keeper_disabled" });
    expect(mockPay).not.toHaveBeenCalled();
  });
});

describe("POST /api/mining/electricity/pay — body", () => {
  it("accepts an empty body", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("accepts an explicit empty object", async () => {
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
  });

  it("REJECTS a caller-supplied amount rather than silently ignoring it", async () => {
    // The contract reads monthlyElecCost/elecPayee from its own state. Accepting
    // and discarding an amount would let an operator believe they set it.
    const res = await POST(makeRequest(JSON.stringify({ amountUsdc: 5000 })));
    expect(res.status).toBe(400);
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("rejects a caller-supplied payee — redirecting funds is not this route's job", async () => {
    const res = await POST(makeRequest(JSON.stringify({ elecPayee: "0xattacker" })));
    expect(res.status).toBe(400);
    expect(mockPay).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON rather than a 500", async () => {
    const res = await POST(makeRequest("{ not json"));
    expect(res.status).toBe(400);
    expect(mockPay).not.toHaveBeenCalled();
  });
});

describe("POST /api/mining/electricity/pay — chain outcomes", () => {
  it("returns 503 not_deployed and attempts nothing on-chain", async () => {
    mockPay.mockResolvedValue({ status: "blocked", reason: "not_deployed" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "not_deployed" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 503 rpc_error — an outage stays distinct from 'no data'", async () => {
    mockPay.mockResolvedValue({ status: "blocked", reason: "rpc_error", detail: "ETIMEDOUT" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "rpc_error" });
  });

  it("returns 422 on revert", async () => {
    mockPay.mockResolvedValue({ status: "blocked", reason: "revert", detail: "AlreadyPaid()" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ reason: "revert" });
  });

  it("reports a disarmed key as an explicit 503 — never a silent success", async () => {
    mockPay.mockResolvedValue({ status: "blocked", reason: "key_missing" });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ reason: "keeper_key_unavailable" });
    // The publisher.ts pattern (`ok: true, armed: false`) must never reappear.
    expect(body).not.toMatchObject({ status: "sent" });
  });
});

describe("POST /api/mining/electricity/pay — success", () => {
  it("returns 200 with the tx data", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "sent", txHash: TX });
  });

  it("audits the fund movement", async () => {
    await POST(makeRequest());
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorWallet: "0xadmin",
        action: "keeper.payElectricity",
        entityType: "DynaVaultKeeper",
        entityId: VAULT,
        after: expect.objectContaining({ txHash: TX }),
      }),
    );
  });
});
