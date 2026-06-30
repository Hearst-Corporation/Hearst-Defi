/**
 * MISSION #042 — Pre-Live Live Safety: dev-login kill-switch contract.
 *
 * GET /api/auth/dev-login is a DEV-ONLY authentication bypass. It MUST be
 * impossible to use in production. The route delegates the decision to
 * `isDevAuthBypass()` (src/lib/dev-bypass.ts), which is DOUBLE-GATED:
 *   1. NODE_ENV !== "production"
 *   2. DEV_AUTH_BYPASS === "1"
 *
 * This suite proves BOTH halves of the contract without touching the DB or
 * cookies (the session layer is mocked):
 *   • when the gate is OFF (prod build, or flag absent) → 404, no session minted
 *   • when the gate is ON  (dev + explicit flag)        → 307 redirect to `?next`
 *     when supplied, otherwise to the default landing for the bypass role
 *
 * It also exercises the REAL `isDevAuthBypass()` against process.env so a
 * regression that loosens the gate (e.g. dropping the prod check) is caught.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

// ── Hoist mocks before module imports ─────────────────────────────────────

vi.mock("server-only", () => ({}));

// Gate decision — controlled per test.
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypass: vi.fn(),
}));

// Session layer — mocked so the route never touches Prisma / next/headers.
vi.mock("@/lib/auth/session", () => ({
  ensureDevUser: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

// ── Import modules AFTER mocks are set up ─────────────────────────────────

import { GET } from "@/app/api/auth/dev-login/route";
import { isDevAuthBypass } from "@/lib/dev-bypass";
import {
  ensureDevUser,
  createSession,
  setSessionCookie,
} from "@/lib/auth/session";

const mockIsDevAuthBypass = vi.mocked(isDevAuthBypass);
const mockEnsureDevUser = vi.mocked(ensureDevUser);
const mockCreateSession = vi.mocked(createSession);
const mockSetSessionCookie = vi.mocked(setSessionCookie);

function makeRequest(path = "http://localhost:4105/api/auth/dev-login"): NextRequest {
  return new NextRequest(new URL(path), {
    method: "GET",
  });
}

describe("GET /api/auth/dev-login — kill-switch (Mission #042)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 404 and mints NO session when the dev bypass is disabled (prod / flag off)", async () => {
    mockIsDevAuthBypass.mockReturnValue(false);

    const res = await GET(makeRequest());

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not available");

    // The auth bypass must do NOTHING when gated off.
    expect(mockEnsureDevUser).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSetSessionCookie).not.toHaveBeenCalled();
  });

  it("mints a dev session and redirects to the internal ?next target when the bypass is enabled", async () => {
    mockIsDevAuthBypass.mockReturnValue(true);
    mockEnsureDevUser.mockResolvedValue({ id: "dev_user_1", role: "admin" } as Awaited<
      ReturnType<typeof ensureDevUser>
    >);
    mockCreateSession.mockResolvedValue({
      token: "tok_dev",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    mockSetSessionCookie.mockResolvedValue(undefined);

    const res = await GET(
      makeRequest(
        "http://localhost:4105/api/auth/dev-login?next=%2Fadmin%2Fproduct-workspace",
      ),
    );

    // 307 = NextResponse.redirect default.
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:4105/admin/product-workspace",
    );

    expect(mockEnsureDevUser).toHaveBeenCalledOnce();
    expect(mockCreateSession).toHaveBeenCalledWith("dev_user_1");
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      "tok_dev",
      new Date("2099-01-01T00:00:00.000Z"),
    );
  });

  it("falls back to the admin landing when no ?next is supplied", async () => {
    mockIsDevAuthBypass.mockReturnValue(true);
    mockEnsureDevUser.mockResolvedValue({ id: "dev_user_2", role: "admin" } as Awaited<
      ReturnType<typeof ensureDevUser>
    >);
    mockCreateSession.mockResolvedValue({
      token: "tok_admin",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    mockSetSessionCookie.mockResolvedValue(undefined);

    const res = await GET(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:4105/admin/dashboard",
    );
  });
});

/**
 * Defence-in-depth: the REAL gate must stay double-locked. These assertions
 * exercise the actual `isDevAuthBypass` (un-mocked via importActual) against a
 * controlled process.env, so a future edit that drops the NODE_ENV check or the
 * explicit flag fails here even if the route test above keeps passing.
 */
describe("isDevAuthBypass — real gate is double-locked", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_FLAG = process.env.DEV_AUTH_BYPASS;

  function setEnv(nodeEnv: string, flag: string | undefined) {
    // NODE_ENV is read-only-typed; assign through a cast for the test only.
    (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
    if (flag === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = flag;
  }

  // Restore env after the suite so we never leak state into other tests.
  afterAll(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      ORIGINAL_NODE_ENV;
    if (ORIGINAL_FLAG === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = ORIGINAL_FLAG;
  });

  it.each([
    ["production", "1", false], // prod + flag on  → still OFF (prod check wins)
    ["production", undefined, false], // prod, no flag   → OFF
    ["development", undefined, false], // dev, no flag    → OFF (flag required)
    ["development", "0", false], // dev, flag "0"   → OFF
    ["development", "1", true], // dev + flag "1"  → ON (the only ON case)
    ["test", "1", true], // test + flag "1" → ON
  ])(
    "NODE_ENV=%s DEV_AUTH_BYPASS=%s → bypass=%s",
    async (nodeEnv, flag, expected) => {
      setEnv(nodeEnv, flag as string | undefined);
      const { isDevAuthBypass: realIsDevAuthBypass } =
        await vi.importActual<typeof import("@/lib/dev-bypass")>(
          "@/lib/dev-bypass",
        );
      expect(realIsDevAuthBypass()).toBe(expected);
    },
  );
});
