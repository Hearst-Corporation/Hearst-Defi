import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
vi.mock("@/lib/chain/keeper", () => ({ isKeeperEnabled: vi.fn() }));

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isKeeperEnabled } from "@/lib/chain/keeper";
import { assertRateLimit } from "@/lib/rate-limit";
import { POST as initiate } from "@/app/api/btc-deposit/initiate/route";
import { POST as complete } from "@/app/api/btc-deposit/complete/route";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockIsKeeperEnabled = vi.mocked(isKeeperEnabled);
const mockRateLimit = vi.mocked(assertRateLimit);
const mockAudit = vi.mocked(recordAdminAudit);

type Handler = (request: NextRequest) => Promise<Response>;

const ROUTES: Array<[string, Handler]> = [
  ["initiate", initiate],
  ["complete", complete],
];

function makeRequest(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/btc-deposit/${path}`, {
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

describe.each(ROUTES)("POST /api/btc-deposit/%s", (path, handler) => {
  describe("auth is fail-closed", () => {
    it("returns 401 when unauthenticated", async () => {
      mockRequireAdmin.mockRejectedValue(
        new Error("Authentication required. Please log in."),
      );
      const res = await handler(makeRequest(path));
      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-admin", async () => {
      mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));
      const res = await handler(makeRequest(path));
      expect(res.status).toBe(403);
    });

    it("returns 429 when rate-limited", async () => {
      mockRateLimit.mockRejectedValue(new Error("Rate limit exceeded."));
      const res = await handler(makeRequest(path));
      expect(res.status).toBe(429);
    });
  });

  describe("kill-switch", () => {
    it("returns 503 keeper_disabled by default", async () => {
      mockIsKeeperEnabled.mockReturnValue(false);
      const res = await handler(makeRequest(path));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ reason: "keeper_disabled" });
    });
  });

  describe("body validation — nothing is presumed (strict empty object)", () => {
    it.each([
      ["an amount", { amount: "1000000" }],
      ["an address", { address: "0xdead" }],
      ["a txid", { txid: "abc" }],
      ["any unknown key", { foo: "bar" }],
    ])("returns 400 for a body carrying %s", async (_label, body) => {
      const res = await handler(makeRequest(path, body));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ reason: "invalid_body" });
    });

    it("returns 400 for malformed JSON rather than a 500", async () => {
      const res = await handler(
        new NextRequest(`http://localhost/api/btc-deposit/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{ not json",
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("honestly unavailable today (no BTC-deposit flow in the contract)", () => {
    it("returns 501 not_supported for a no-body POST and audits nothing", async () => {
      const res = await handler(makeRequest(path));
      expect(res.status).toBe(501);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      const body = await res.json();
      expect(body).toMatchObject({ reason: "not_supported" });
      expect(body).not.toMatchObject({ status: "sent" });
      expect(typeof body.detail).toBe("string");
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("returns 501 not_supported for an explicit empty object too", async () => {
      const res = await handler(makeRequest(path, {}));
      expect(res.status).toBe(501);
      expect(await res.json()).toMatchObject({ reason: "not_supported" });
    });
  });
});
