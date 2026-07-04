/**
 * claimKycInquiry (src/lib/onboarding/actions.ts) — P0-4 binding unit tests.
 *
 * claimKycInquiry is the server-authoritative link applicantId→userId that the
 * webhook trusts INSTEAD of the client-echoed externalUserId. These tests lock:
 *   - the happy path (new claim creates the KycInquiry row)
 *   - idempotence for the same (inquiryId, userId)
 *   - anti-theft: a different user re-claiming an inquiryId is rejected
 *   - the P2002 create-race collapses to the same anti-theft verdict
 *   - the B1 replay: a terminal event already archived triggers markKycComplete
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-investor", () => ({
  requireInvestor: vi.fn().mockResolvedValue({ userId: "user_1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    kycInquiry: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    kycEvent: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/onboarding/kyc-complete", () => ({
  markKycComplete: vi.fn().mockResolvedValue(undefined),
}));

import { requireInvestor } from "@/lib/auth/require-investor";
import { prisma } from "@/lib/db";
import { markKycComplete } from "@/lib/onboarding/kyc-complete";
import { claimKycInquiry } from "@/lib/onboarding/actions";

const p2002 = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("claimKycInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireInvestor).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(prisma.kycInquiry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.kycInquiry.create).mockResolvedValue({} as never);
    vi.mocked(prisma.kycEvent.findFirst).mockResolvedValue(null);
  });

  it("rejects an empty inquiryId", async () => {
    await expect(claimKycInquiry("  ")).rejects.toThrow(/non-empty/);
    expect(prisma.kycInquiry.create).not.toHaveBeenCalled();
  });

  it("creates the KycInquiry row for a fresh applicantId", async () => {
    const res = await claimKycInquiry("appl_new");
    expect(res).toEqual({ ok: true });
    expect(prisma.kycInquiry.create).toHaveBeenCalledWith({
      data: { inquiryId: "appl_new", userId: "user_1" },
    });
  });

  it("is idempotent when the SAME user re-claims (no second create)", async () => {
    vi.mocked(prisma.kycInquiry.findUnique).mockResolvedValue({
      inquiryId: "appl_x",
      userId: "user_1",
      createdAt: new Date(),
    } as never);

    const res = await claimKycInquiry("appl_x");
    expect(res).toEqual({ ok: true });
    expect(prisma.kycInquiry.create).not.toHaveBeenCalled();
  });

  it("ANTI-THEFT: rejects when a DIFFERENT user already owns the inquiryId", async () => {
    vi.mocked(prisma.kycInquiry.findUnique).mockResolvedValue({
      inquiryId: "appl_stolen",
      userId: "victim",
      createdAt: new Date(),
    } as never);

    await expect(claimKycInquiry("appl_stolen")).rejects.toThrow(
      /already claimed by another account/,
    );
    expect(prisma.kycInquiry.create).not.toHaveBeenCalled();
    expect(markKycComplete).not.toHaveBeenCalled();
  });

  it("ANTI-THEFT under a create race: P2002 then a foreign owner is rejected", async () => {
    // findUnique returns null (no row yet), create loses the race → P2002, and
    // the post-race read reveals a different owner.
    vi.mocked(prisma.kycInquiry.findUnique)
      .mockResolvedValueOnce(null) // pre-create check
      .mockResolvedValueOnce({
        inquiryId: "appl_race",
        userId: "attacker_won",
        createdAt: new Date(),
      } as never); // post-P2002 verification
    vi.mocked(prisma.kycInquiry.create).mockRejectedValueOnce(p2002());

    await expect(claimKycInquiry("appl_race")).rejects.toThrow(
      /already claimed by another account/,
    );
  });

  it("P2002 race won by our own concurrent claim resolves to success", async () => {
    vi.mocked(prisma.kycInquiry.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        inquiryId: "appl_self",
        userId: "user_1", // same owner — our own concurrent write
        createdAt: new Date(),
      } as never);
    vi.mocked(prisma.kycInquiry.create).mockRejectedValueOnce(p2002());

    const res = await claimKycInquiry("appl_self");
    expect(res).toEqual({ ok: true });
  });

  it("B1 replay: replays markKycComplete when a terminal event already landed", async () => {
    // Webhook raced ahead of the claim and archived a GREEN event.
    vi.mocked(prisma.kycEvent.findFirst).mockResolvedValue({
      id: "evt_1",
      inquiryId: "appl_raced",
      status: "approved",
    } as never);

    const res = await claimKycInquiry("appl_raced");
    expect(res).toEqual({ ok: true });
    expect(markKycComplete).toHaveBeenCalledWith("appl_raced");
  });

  it("does NOT replay markKycComplete when no terminal event exists yet", async () => {
    vi.mocked(prisma.kycEvent.findFirst).mockResolvedValue(null);
    await claimKycInquiry("appl_pending");
    expect(markKycComplete).not.toHaveBeenCalled();
  });
});
