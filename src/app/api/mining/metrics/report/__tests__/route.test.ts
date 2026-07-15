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
// Mocking the keeper (the leaf) keeps the REAL guard under test while making the
// chain unreachable — no dynavault resolution, no network.
vi.mock("@/lib/chain/keeper", () => ({
  isKeeperEnabled: vi.fn(),
  reportMiningMetrics: vi.fn(),
}));

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isKeeperEnabled, reportMiningMetrics } from "@/lib/chain/keeper";
import { assertRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/mining/metrics/report/route";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockIsKeeperEnabled = vi.mocked(isKeeperEnabled);
const mockReport = vi.mocked(reportMiningMetrics);
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

const VALID_BODY = { hashrateTh: 12_500, btcEarnedSats: 4_200_000 };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mining/metrics/report", {
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
  mockReport.mockResolvedValue(SENT);
  mockAudit.mockResolvedValue(undefined);
});

describe("POST /api/mining/metrics/report — auth is fail-closed", () => {
  it("returns 401 when unauthenticated, without touching the chain", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin, without touching the chain", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("checks auth BEFORE the kill-switch — an anonymous caller cannot probe it", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );
    await POST(makeRequest(VALID_BODY));
    expect(mockIsKeeperEnabled).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded. Try again in 42s."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(mockReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/mining/metrics/report — kill-switch", () => {
  it("returns 503 keeper_disabled when KEEPER_ENABLED is off", async () => {
    mockIsKeeperEnabled.mockReturnValue(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "keeper_disabled" });
    expect(mockReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/mining/metrics/report — body validation", () => {
  const INVALID_BODIES: Array<[string, unknown]> = [
    ["empty body", {}],
    ["negative hashrate", { hashrateTh: -1, btcEarnedSats: 0 }],
    ["negative sats", { hashrateTh: 1, btcEarnedSats: -1 }],
    ["fractional hashrate", { hashrateTh: 1.5, btcEarnedSats: 0 }],
    ["string hashrate", { hashrateTh: "1", btcEarnedSats: 0 }],
    ["hashrate past the network maximum", { hashrateTh: 1_000_000_001, btcEarnedSats: 0 }],
    ["sats past total BTC supply", { hashrateTh: 1, btcEarnedSats: 2_100_000_000_000_001 }],
    ["unknown key", { hashrateTh: 1, btcEarnedSats: 1, receiver: "0xdead" }],
    ["null", null],
  ];

  it.each(INVALID_BODIES)("returns 400 for %s and never signs", async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON rather than throwing a 500", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/mining/metrics/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("accepts the boundary values", async () => {
    const res = await POST(
      makeRequest({ hashrateTh: 1_000_000_000, btcEarnedSats: 2_100_000_000_000_000 }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts zeroes — an idle fleet is a real reading, not an invalid one", async () => {
    const res = await POST(makeRequest({ hashrateTh: 0, btcEarnedSats: 0 }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/mining/metrics/report — chain outcomes stay discernible", () => {
  it("returns 503 not_deployed and attempts nothing when the vault is not v2", async () => {
    mockReport.mockResolvedValue({ status: "blocked", reason: "not_deployed" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "not_deployed" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns 503 rpc_error — an outage is NOT an absence of data", async () => {
    mockReport.mockResolvedValue({ status: "blocked", reason: "rpc_error", detail: "timeout" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "rpc_error" });
  });

  it("returns 422 on a revert — the chain was reached and refused", async () => {
    mockReport.mockResolvedValue({ status: "blocked", reason: "revert", detail: "onlyKeeper" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ reason: "revert" });
  });

  it("collapses a missing key to keeper_key_unavailable and never names the cause", async () => {
    mockReport.mockResolvedValue({ status: "blocked", reason: "key_missing" });
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ reason: "keeper_key_unavailable" });
    expect(JSON.stringify(body)).not.toContain("key_missing");
  });

  it("never forwards the server-side `detail` to the client", async () => {
    mockReport.mockResolvedValue({
      status: "blocked",
      reason: "revert",
      detail: "execution reverted: NotKeeper(0xsecret)",
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(JSON.stringify(await res.json())).not.toContain("0xsecret");
  });
});

describe("POST /api/mining/metrics/report — success", () => {
  it("returns 200 with the tx data and no-store", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: "sent", txHash: TX, chainId: 84532 });
  });

  it("passes the validated values through to the keeper", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockReport).toHaveBeenCalledWith(VALID_BODY);
  });

  it("audits the landed transaction", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorWallet: "0xadmin",
        action: "keeper.reportMiningMetrics",
        entityType: "DynaVaultKeeper",
        entityId: VAULT,
        after: expect.objectContaining({ txHash: TX }),
      }),
    );
  });

  it("falls back to the user id as actorWallet when the admin has no wallet", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" });
    await POST(makeRequest(VALID_BODY));
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorWallet: "admin_1" }),
    );
  });

  it("still returns 200 when the audit write fails — the tx really did land", async () => {
    mockAudit.mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
  });
});
