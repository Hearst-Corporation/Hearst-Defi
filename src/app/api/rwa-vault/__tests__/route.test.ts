import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// keeper-guard is `server-only`; the GET half of the route pulls in requireAuth
// and the dynavault adapter. Mock every side-effecting import so this file
// exercises the POST in isolation, exactly like the shipped keeper route tests.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/admin/audit", () => ({ recordAdminAudit: vi.fn() }));
vi.mock("@/lib/chain/keeper", () => ({ isKeeperEnabled: vi.fn() }));
vi.mock("@/lib/chain/dynavault", () => ({
  CHAIN_ID: 84532,
  getVaultMode: vi.fn(() => "legacy"),
  readElecStatus: vi.fn(),
  readMiningMetrics: vi.fn(),
  readStrategies: vi.fn(),
}));

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isKeeperEnabled } from "@/lib/chain/keeper";
import { assertRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/rwa-vault/route";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockIsKeeperEnabled = vi.mocked(isKeeperEnabled);
const mockRateLimit = vi.mocked(assertRateLimit);
const mockAudit = vi.mocked(recordAdminAudit);

const VALID_BODY = { action: "deposit", amount: "1000000" };

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/rwa-vault", {
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
  mockAudit.mockResolvedValue(undefined);
});

describe("POST /api/rwa-vault — auth is fail-closed", () => {
  it("returns 401 when unauthenticated", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded."));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/rwa-vault — kill-switch", () => {
  it("returns 503 keeper_disabled by default", async () => {
    mockIsKeeperEnabled.mockReturnValue(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "keeper_disabled" });
  });
});

describe("POST /api/rwa-vault — body validation", () => {
  const INVALID_BODIES: Array<[string, unknown]> = [
    ["empty body", {}],
    ["null", null],
    ["missing amount", { action: "deposit" }],
    ["missing action", { amount: "1000000" }],
    ["unknown action value", { action: "burn", amount: "1000000" }],
    ["action as number", { action: 1, amount: "1000000" }],
    ["amount as a number, not a string", { action: "deposit", amount: 1000000 }],
    ["amount zero", { action: "deposit", amount: "0" }],
    ["amount negative", { action: "deposit", amount: "-1" }],
    ["amount fractional", { action: "deposit", amount: "1.5" }],
    ["amount scientific", { action: "deposit", amount: "1e6" }],
    ["amount hex", { action: "deposit", amount: "0x10" }],
    ["amount leading zero", { action: "deposit", amount: "007" }],
    ["amount non-numeric", { action: "deposit", amount: "abc" }],
    ["unknown key", { action: "deposit", amount: "1000000", receiver: "0xdead" }],
  ];

  it.each(INVALID_BODIES)("returns 400 for %s", async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: "invalid_body" });
  });

  it("returns 400 for an amount past uint256 rather than throwing", async () => {
    const res = await POST(
      makeRequest({ action: "deposit", amount: (2n ** 256n).toString() }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an absurdly long digit string without calling BigInt on it", async () => {
    const res = await POST(
      makeRequest({ action: "deposit", amount: "9".repeat(5000) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON rather than a 500", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/rwa-vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/rwa-vault — honestly unavailable today (no contract function)", () => {
  it.each(["deposit", "withdraw", "deposit_yield"])(
    "returns 501 not_supported_by_contract for a valid '%s' and audits nothing",
    async (action) => {
      const res = await POST(makeRequest({ action, amount: "1000000" }));
      expect(res.status).toBe(501);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = await res.json();
      expect(body).toMatchObject({ reason: "not_supported_by_contract" });
      // A well-formed request must not be mistaken for a fund movement.
      expect(body).not.toMatchObject({ status: "sent" });
      // Nothing reached the chain, so nothing is audited.
      expect(mockAudit).not.toHaveBeenCalled();
    },
  );

  it("carries an explanatory detail but leaks no internals", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json();
    expect(typeof body.detail).toBe("string");
    expect(body.detail.length).toBeGreaterThan(0);
  });
});
