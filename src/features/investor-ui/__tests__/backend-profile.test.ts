/**
 * BackendInvestorUiDataSource.getProfile — wired to GET /api/v1/profile
 * (backend 7cf84d9). These pin the honesty contract of the wiring:
 *
 *   - the backend's identity status flows through untouched (LIVE stays LIVE,
 *     PARTIAL/"no_investor_record" is a PRODUCT state — not an error, no
 *     throw — and UNAVAILABLE/"db_error" stays an unavailability);
 *   - the eight blocks the backend does not serve resolve NOT_CONFIGURED with
 *     the explicit "no backend endpoint" motive — never a fabricated empty
 *     value (an all-false preferences block would state choices the user
 *     never made);
 *   - a transport failure (404 from an older backend included) propagates as
 *     a BackendError — never a fake profile.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Envelope, ProfileDTO } from "@/lib/backend/contracts";
// Imported from the internal module, NOT the barrel: the barrel re-exports
// server-client.ts, whose import graph reaches getSession → Prisma — a
// server-only chain a unit test must not boot. BackendError is pure.
import { BackendError } from "@/lib/backend/errors";

const getProfileFromBackend = vi.fn();

// The barrel is mocked WITHOUT importActual for the same reason: loading the
// real module would drag the server-only graph in. The data source consumes
// exactly these named exports; the mock provides them and nothing else, so a
// new dependency fails loudly here instead of silently reaching Prisma.
vi.mock("@/lib/backend", () => ({
  getProfileFromBackend: (...a: unknown[]) => getProfileFromBackend(...a),
  getBtcFromBackend: vi.fn(),
  getMiningFromBackend: vi.fn(),
  getDashboardFromBackend: vi.fn(),
  isBackendError: (e: unknown) => e instanceof BackendError,
}));

import { BackendInvestorUiDataSource } from "../data-source/backend-data-source";

const GENERATED_AT = "2026-07-22T18:00:00.000Z";

function envelopeOf(identity: ProfileDTO["identity"]): Envelope<ProfileDTO> {
  return {
    data: { identity },
    meta: {
      status: identity.status === "LIVE" ? "LIVE" : "SNAPSHOT",
      source: "database",
      generatedAt: GENERATED_AT,
      freshnessSeconds: 0,
      version: "v1",
      reason: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackendInvestorUiDataSource.getProfile — wired, no NOT_WIRED throw", () => {
  it("LIVE identity maps through with nulls preserved — nothing defaulted", async () => {
    getProfileFromBackend.mockResolvedValue(
      envelopeOf({
        status: "LIVE",
        value: {
          kycStatus: "approved",
          shareClass: null, // DB does not hold this — must STAY null
          whitelisted: null, // on-chain fact, unread — must STAY null
          walletAddress: "0x1111111111111111111111111111111111111111",
          accredited: true,
        },
        provenance: "db",
        freshness: { asOf: GENERATED_AT, ageSeconds: 0, stale: false },
      }),
    );

    const profile = await new BackendInvestorUiDataSource().getProfile();
    expect(profile.generatedAt).toBe(GENERATED_AT);
    expect(profile.identity.status).toBe("LIVE");
    expect(profile.identity.value?.kycStatus).toBe("approved");
    expect(profile.identity.value?.shareClass).toBeNull();
    expect(profile.identity.value?.whitelisted).toBeNull();
  });

  it("PARTIAL/no_investor_record is a product state — resolves, never throws", async () => {
    getProfileFromBackend.mockResolvedValue(
      envelopeOf({
        status: "PARTIAL",
        value: null,
        provenance: "db",
        freshness: { asOf: null, ageSeconds: null, stale: false },
        reason: "no_investor_record",
      }),
    );

    const profile = await new BackendInvestorUiDataSource().getProfile();
    expect(profile.identity.status).toBe("PARTIAL");
    expect(profile.identity.value).toBeNull();
    expect(profile.identity.error?.code).toBe("no_investor_record");
  });

  it("UNAVAILABLE/db_error stays an unavailability — never an empty profile posing as data", async () => {
    getProfileFromBackend.mockResolvedValue(
      envelopeOf({
        status: "UNAVAILABLE",
        value: null,
        provenance: "db",
        freshness: { asOf: null, ageSeconds: null, stale: false },
        reason: "db_error",
      }),
    );

    const profile = await new BackendInvestorUiDataSource().getProfile();
    expect(profile.identity.status).toBe("UNAVAILABLE");
    expect(profile.identity.value).toBeNull();
    expect(profile.identity.error?.code).toBe("db_error");
  });

  it("the eight unserved blocks resolve NOT_CONFIGURED with the explicit motive — no fabricated values", async () => {
    getProfileFromBackend.mockResolvedValue(
      envelopeOf({
        status: "LIVE",
        value: {
          kycStatus: "approved",
          shareClass: null,
          whitelisted: null,
          walletAddress: null,
          accredited: false,
        },
        provenance: "db",
        freshness: { asOf: GENERATED_AT, ageSeconds: 0, stale: false },
      }),
    );

    const profile = await new BackendInvestorUiDataSource().getProfile();
    const unserved = [
      profile.contact,
      profile.kyc,
      profile.investorStatus,
      profile.security,
      profile.preferences,
      profile.documents,
      profile.subscriptionHistory,
      profile.activity,
    ];
    for (const block of unserved) {
      expect(block.status).toBe("NOT_CONFIGURED");
      expect(block.value).toBeNull();
      expect(block.error?.code).toBe("no_backend_endpoint");
    }
  });

  it("a transport failure (404 included) propagates as BackendError — never a fake profile", async () => {
    getProfileFromBackend.mockRejectedValue(
      new BackendError("Backend 404 on /api/v1/profile", {
        status: 404,
        code: "http",
        requestId: "req-1",
        path: "/api/v1/profile",
      }),
    );

    await expect(new BackendInvestorUiDataSource().getProfile()).rejects.toBeInstanceOf(
      BackendError,
    );
  });

  it("getProfile no longer throws the NOT_WIRED message", async () => {
    getProfileFromBackend.mockResolvedValue(
      envelopeOf({
        status: "PARTIAL",
        value: null,
        provenance: "db",
        freshness: { asOf: null, ageSeconds: null, stale: false },
        reason: "no_investor_record",
      }),
    );
    // The old implementation threw synchronously with "not wired". Resolving
    // at all is the proof; the assertion pins it.
    await expect(new BackendInvestorUiDataSource().getProfile()).resolves.toBeDefined();
  });
});
