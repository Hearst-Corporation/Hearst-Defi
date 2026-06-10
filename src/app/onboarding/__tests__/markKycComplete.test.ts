/**
 * Unit tests for claimKycInquiry and markKycComplete server actions.
 *
 * Covers:
 *   - P0-4: claimKycInquiry binds an inquiry to the authenticated session user.
 *   - P0-4: cross-user re-claim is rejected.
 *   - P0-4: same-user re-claim is idempotent.
 *   - P0-4 (markKycComplete): userId resolved from KycInquiry claim, not KycEvent.
 *   - P0-5: only pending→approved; rejected investors are terminal.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/db
// ---------------------------------------------------------------------------

const mockKycInquiryFindUnique = vi.fn();
const mockKycInquiryCreate = vi.fn().mockResolvedValue({});
const mockKycEventFindFirst = vi.fn().mockResolvedValue(null);
const mockInvestorUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

vi.mock("@/lib/db", () => ({
  prisma: {
    kycInquiry: {
      findUnique: mockKycInquiryFindUnique,
      create: mockKycInquiryCreate,
    },
    kycEvent: {
      findFirst: mockKycEventFindFirst,
    },
    investor: {
      updateMany: mockInvestorUpdateMany,
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/auth/require-investor
// ---------------------------------------------------------------------------

const mockRequireInvestor = vi.fn();

vi.mock("@/lib/auth/require-investor", () => ({
  requireInvestor: mockRequireInvestor,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("claimKycInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: session user is "u1"
    mockRequireInvestor.mockResolvedValue({ userId: "u1", email: "u1@test.com", role: "investor", walletAddress: null });
    // Default: no existing claim
    mockKycInquiryFindUnique.mockResolvedValue(null);
  });

  it("creates a new KycInquiry for a fresh inquiryId and returns { ok: true }", async () => {
    const { claimKycInquiry } = await import("../actions");

    const result = await claimKycInquiry("inq_new123");

    expect(result).toEqual({ ok: true });
    expect(mockKycInquiryCreate).toHaveBeenCalledOnce();
    const createArg = mockKycInquiryCreate.mock.calls[0]?.[0] as {
      data: { inquiryId: string; userId: string };
    };
    expect(createArg.data.inquiryId).toBe("inq_new123");
    expect(createArg.data.userId).toBe("u1");
  });

  it("re-claim by the same user is idempotent: returns { ok: true } without creating a duplicate", async () => {
    // Existing claim belongs to the same user
    mockKycInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_existing",
      userId: "u1",
      createdAt: new Date(),
    });

    const { claimKycInquiry } = await import("../actions");

    const result = await claimKycInquiry("inq_existing");

    expect(result).toEqual({ ok: true });
    // create must NOT be called again — idempotent
    expect(mockKycInquiryCreate).not.toHaveBeenCalled();
  });

  it("throws when the inquiryId is already claimed by a different userId (anti-theft — P0-4)", async () => {
    // Existing claim belongs to a different user
    mockKycInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_stolen",
      userId: "u2", // different from session user "u1"
      createdAt: new Date(),
    });

    const { claimKycInquiry } = await import("../actions");

    await expect(claimKycInquiry("inq_stolen")).rejects.toThrow(
      /already claimed/i,
    );

    expect(mockKycInquiryCreate).not.toHaveBeenCalled();
  });

  it("throws when inquiryId is empty", async () => {
    const { claimKycInquiry } = await import("../actions");
    await expect(claimKycInquiry("   ")).rejects.toThrow(/inquiryId/i);
  });

  // ---------------------------------------------------------------------------
  // B1: webhook-before-claim race — replay approval on late claim
  // ---------------------------------------------------------------------------

  it("claimKycInquiry replays approval when a terminal KycEvent already exists (webhook raced ahead)", async () => {
    // No existing KycInquiry claim → create succeeds
    mockKycInquiryFindUnique.mockResolvedValue(null);
    mockKycInquiryCreate.mockResolvedValue({});
    // Terminal KycEvent already stored (webhook arrived first)
    mockKycEventFindFirst.mockResolvedValue({ inquiryId: "inq_b1", status: "completed", userId: "unclaimed" });
    // markKycComplete will call kycInquiry.findUnique again (now the claim exists)
    mockKycInquiryFindUnique
      .mockResolvedValueOnce(null)         // first call: no claim yet (pre-create check)
      .mockResolvedValueOnce({ inquiryId: "inq_b1", userId: "u1", createdAt: new Date() }); // second: replay

    const { claimKycInquiry } = await import("../actions");
    await claimKycInquiry("inq_b1");

    // investor.updateMany must have been called (approval replayed)
    expect(mockInvestorUpdateMany).toHaveBeenCalledOnce();
    const callArg = mockInvestorUpdateMany.mock.calls[0]?.[0] as {
      where: { kycStatus: string };
    };
    expect(callArg.where.kycStatus).toBe("pending");
  });

  it("claimKycInquiry no replay when no terminal KycEvent exists", async () => {
    mockKycInquiryFindUnique.mockResolvedValue(null);
    mockKycInquiryCreate.mockResolvedValue({});
    // No terminal event
    mockKycEventFindFirst.mockResolvedValue(null);

    const { claimKycInquiry } = await import("../actions");
    await claimKycInquiry("inq_noterminal");

    // investor.updateMany must NOT be called
    expect(mockInvestorUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // E1: concurrent P2002 handling
  // ---------------------------------------------------------------------------

  it("claimKycInquiry concurrent (P2002 same user) → idempotent ok, no throw", async () => {
    // findUnique returns null (pre-create check) → create throws P2002
    // → re-findUnique returns same user (we lost the race to our own concurrent call)
    mockKycInquiryFindUnique
      .mockResolvedValueOnce(null)  // sequential check: no existing claim
      .mockResolvedValueOnce({ inquiryId: "inq_concurrent", userId: "u1", createdAt: new Date() }); // post-P2002 re-read
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockKycInquiryCreate.mockRejectedValueOnce(p2002);
    // No terminal event
    mockKycEventFindFirst.mockResolvedValue(null);

    const { claimKycInquiry } = await import("../actions");
    const result = await claimKycInquiry("inq_concurrent");

    expect(result).toEqual({ ok: true });
  });

  it("claimKycInquiry P2002 cross-user → throws already claimed", async () => {
    // findUnique returns null → create throws P2002 → re-findUnique returns different user
    mockKycInquiryFindUnique
      .mockResolvedValueOnce(null) // sequential check
      .mockResolvedValueOnce({ inquiryId: "inq_crossuser", userId: "u2", createdAt: new Date() }); // post-P2002
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockKycInquiryCreate.mockRejectedValueOnce(p2002);

    const { claimKycInquiry } = await import("../actions");
    await expect(claimKycInquiry("inq_crossuser")).rejects.toThrow(/already claimed/i);
  });
});

describe("markKycComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no claim, no KycEvent
    mockKycInquiryFindUnique.mockResolvedValue(null);
    mockKycEventFindFirst.mockResolvedValue(null);
    mockInvestorUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("P0-5: calls investor.updateMany with kycStatus='pending' (NOT { not:'approved' })", async () => {
    // Claim resolves to "u1"
    mockKycInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_p05",
      userId: "u1",
      createdAt: new Date(),
    });

    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_p05");

    expect(mockInvestorUpdateMany).toHaveBeenCalledOnce();
    const callArg = mockInvestorUpdateMany.mock.calls[0]?.[0] as {
      where: { user: { id: string }; kycStatus: string };
      data: { kycStatus: string };
    };

    // Must be exact string "pending", not { not: "approved" }
    expect(callArg.where.kycStatus).toBe("pending");
    expect(callArg.data.kycStatus).toBe("approved");
  });

  it("P0-4 authoritative resolution: userId comes from the KycInquiry claim, not KycEvent", async () => {
    // Claim points to "owner"
    mockKycInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_auth",
      userId: "owner",
      createdAt: new Date(),
    });
    // KycEvent would return a different (wrong) userId — must NOT be used
    mockKycEventFindFirst.mockResolvedValue({ userId: "wrong_user", inquiryId: "inq_auth" });

    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_auth");

    expect(mockInvestorUpdateMany).toHaveBeenCalledOnce();
    const callArg = mockInvestorUpdateMany.mock.calls[0]?.[0] as {
      where: { user: { id: string }; kycStatus: string };
    };
    // Must be "owner" from the claim, never "wrong_user" from KycEvent
    expect(callArg.where.user.id).toBe("owner");
  });

  it("falls back to KycEvent when no KycInquiry claim exists (legacy path)", async () => {
    // No claim
    mockKycInquiryFindUnique.mockResolvedValue(null);
    // Legacy KycEvent provides the userId
    mockKycEventFindFirst.mockResolvedValue({
      userId: "legacy_user",
      inquiryId: "inq_legacy",
      status: "completed",
    });

    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_legacy");

    expect(mockInvestorUpdateMany).toHaveBeenCalledOnce();
    const callArg = mockInvestorUpdateMany.mock.calls[0]?.[0] as {
      where: { user: { id: string } };
    };
    expect(callArg.where.user.id).toBe("legacy_user");
  });

  it("does nothing when neither claim nor KycEvent exists", async () => {
    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_unknown");
    expect(mockInvestorUpdateMany).not.toHaveBeenCalled();
  });

  it("does nothing when userId resolves to 'unknown'", async () => {
    mockKycInquiryFindUnique.mockResolvedValue(null);
    mockKycEventFindFirst.mockResolvedValue({ userId: "unknown", inquiryId: "inq_x" });

    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_x");
    expect(mockInvestorUpdateMany).not.toHaveBeenCalled();
  });

  it("throws when inquiryId is empty", async () => {
    const { markKycComplete } = await import("../actions");
    await expect(markKycComplete("")).rejects.toThrow(/inquiryId/i);
  });

  // ---------------------------------------------------------------------------
  // B1: sentinel guard — markKycComplete must ignore userId="unclaimed"
  // ---------------------------------------------------------------------------

  it("markKycComplete ignores sentinel userId 'unclaimed'", async () => {
    // Simulates the legacy-fallback path resolving the sentinel (edge: no claim
    // but the KycEvent was written with the sentinel userId by the webhook).
    mockKycInquiryFindUnique.mockResolvedValue(null);
    mockKycEventFindFirst.mockResolvedValue({
      userId: "unclaimed",
      inquiryId: "inq_sentinel",
      status: "completed",
    });

    const { markKycComplete } = await import("../actions");
    await markKycComplete("inq_sentinel");

    // Must NOT update any investor
    expect(mockInvestorUpdateMany).not.toHaveBeenCalled();
  });
});
