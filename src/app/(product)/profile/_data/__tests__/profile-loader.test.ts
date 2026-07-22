/**
 * /profile loader — the page's single profile read path.
 *
 * Pins that the page consumes the backend contract through the shared data
 * source (not Prisma, not readWhitelist-as-profile), and that every honest
 * state traverses:
 *   - "ok" carries the ProfileViewModel through, whatever the identity status
 *     (LIVE, PARTIAL/no_investor_record, UNAVAILABLE/db_error) — a product
 *     state or a backend-side unavailability is DATA, not an exception;
 *   - "error" is reserved for a transport failure (BackendError, including a
 *     404 from an older backend) — "we couldn't reach the data", rendered
 *     distinctly from "no investor record".
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { BackendError } from "@/lib/backend/errors";
import type { ProfileViewModel } from "@/features/investor-ui/types/profile";
import { resolved } from "@/features/investor-ui/types/common";

const getProfile = vi.fn();

vi.mock("@/features/investor-ui/data-source/backend-data-source", () => ({
  BackendInvestorUiDataSource: class {
    getProfile = (...a: unknown[]) => getProfile(...a);
  },
}));

// The loader imports the barrel only for isBackendError — mocked shallow so
// the server-only graph (getSession → Prisma) never boots in a unit test.
vi.mock("@/lib/backend", () => ({
  isBackendError: (e: unknown) => e instanceof BackendError,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { loadProfilePageData } from "../profile-loader";

function profileWithIdentityStatus(
  status: "LIVE" | "PARTIAL" | "UNAVAILABLE",
  reason?: string,
): ProfileViewModel {
  const notServed = resolved<never>("NOT_CONFIGURED", null, {
    error: { code: "no_backend_endpoint", message: "identity-only" },
  });
  return {
    generatedAt: "2026-07-22T18:00:00.000Z",
    identity: resolved(
      status,
      status === "LIVE"
        ? { kycStatus: "approved", shareClass: null, whitelisted: null, walletAddress: null, accredited: true }
        : null,
      reason ? { error: { code: reason, message: reason } } : undefined,
    ),
    contact: notServed,
    kyc: notServed,
    investorStatus: notServed,
    security: notServed,
    preferences: notServed,
    documents: notServed,
    subscriptionHistory: notServed,
    activity: notServed,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("loadProfilePageData", () => {
  it("ok: LIVE identity passes through untouched", async () => {
    getProfile.mockResolvedValue(profileWithIdentityStatus("LIVE"));
    const data = await loadProfilePageData();
    expect(data.state).toBe("ok");
    if (data.state === "ok") {
      expect(data.profile.identity.status).toBe("LIVE");
      // Nulls preserved — the loader adds nothing.
      expect(data.profile.identity.value?.shareClass).toBeNull();
    }
  });

  it("ok: PARTIAL/no_investor_record is a product state, not an error", async () => {
    getProfile.mockResolvedValue(
      profileWithIdentityStatus("PARTIAL", "no_investor_record"),
    );
    const data = await loadProfilePageData();
    // The brand-new-account state must reach the page as DATA so it renders
    // "not yet started" — never the error block.
    expect(data.state).toBe("ok");
    if (data.state === "ok") {
      expect(data.profile.identity.status).toBe("PARTIAL");
      expect(data.profile.identity.error?.code).toBe("no_investor_record");
    }
  });

  it("ok: UNAVAILABLE/db_error stays a backend-side unavailability, not a transport error", async () => {
    getProfile.mockResolvedValue(profileWithIdentityStatus("UNAVAILABLE", "db_error"));
    const data = await loadProfilePageData();
    expect(data.state).toBe("ok");
    if (data.state === "ok") {
      expect(data.profile.identity.status).toBe("UNAVAILABLE");
      expect(data.profile.identity.value).toBeNull();
    }
  });

  it("error: a BackendError (404 included) becomes the distinct 'couldn't reach' state", async () => {
    getProfile.mockRejectedValue(
      new BackendError("Backend 404 on /api/v1/profile", {
        status: 404,
        code: "http",
        requestId: "req-1",
        path: "/api/v1/profile",
      }),
    );
    const data = await loadProfilePageData();
    expect(data.state).toBe("error");
    if (data.state === "error") {
      // The detail is for logs; the page renders a generic honest block, and
      // it must NEVER be mistaken for "no investor record".
      expect(data.detail).toContain("/api/v1/profile");
      expect(data.detail).toContain("404");
    }
  });

  it("never fabricates a profile on failure — error state carries no profile at all", async () => {
    getProfile.mockRejectedValue(
      new BackendError("timeout", { status: null, code: "timeout", requestId: "r", path: "/api/v1/profile" }),
    );
    const data = await loadProfilePageData();
    expect(data.state).toBe("error");
    expect("profile" in data).toBe(false);
  });
});
