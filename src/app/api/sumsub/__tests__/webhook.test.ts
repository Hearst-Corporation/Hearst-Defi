/**
 * POST /api/sumsub/webhook — unit tests
 *
 * Tests HMAC verification (x-payload-digest), payload parsing, KycInquiry-claim
 * resolution, and KycEvent persistence without hitting a real database
 * (prisma is mocked).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Mock prisma — must be set up before the route module is imported
// ---------------------------------------------------------------------------

const mockCreate = vi.fn().mockResolvedValue({});
const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockInquiryFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    kycEvent: {
      create: mockCreate,
    },
    investor: {
      updateMany: mockUpdateMany,
    },
    kycInquiry: {
      findUnique: mockInquiryFindUnique,
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sumsub signs the RAW body: HMAC_SHA256(secret, rawBody) as hex. */
function buildDigest(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const APPROVED_PAYLOAD = JSON.stringify({
  type: "applicantReviewed",
  applicantId: "appl_test123",
  externalUserId: "user_abc",
  reviewResult: { reviewAnswer: "GREEN" },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/sumsub/webhook", () => {
  const SECRET = "test-webhook-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUMSUB_WEBHOOK_SECRET = SECRET;
    // Default: the applicant is claimed by "user_abc" (happy path)
    mockInquiryFindUnique.mockResolvedValue({
      inquiryId: "appl_test123",
      userId: "user_abc",
      createdAt: new Date(),
    });
  });

  it("returns 413 when content-length exceeds 1 MB (before HMAC check)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1_000_001),
      },
      body: APPROVED_PAYLOAD,
    });
    const res = await POST(nextReq);
    expect(res.status).toBe(413);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when x-payload-digest header is missing", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: APPROVED_PAYLOAD,
    });
    const res = await POST(nextReq);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": "deadbeef",
      },
      body: APPROVED_PAYLOAD,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when digest is valid for SHA256 but algorithm header claims SHA512", async () => {
    // The digest is correct under SHA256 but the alg header forces SHA512 → mismatch.
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, APPROVED_PAYLOAD),
        "x-payload-digest-alg": "HMAC_SHA512_HEX",
      },
      body: APPROVED_PAYLOAD,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and persists KycEvent with userId from the KycInquiry claim, then approves (GREEN)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, APPROVED_PAYLOAD),
        // No alg header → defaults to HMAC_SHA256_HEX
      },
      body: APPROVED_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);

    // KycEvent should have been created with the claim's userId, not the payload hint.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { inquiryId: string; status: string; userId: string };
    };
    expect(createCall.data.inquiryId).toBe("appl_test123");
    expect(createCall.data.status).toBe("approved");
    expect(createCall.data.userId).toBe("user_abc");

    // GREEN review → investor approved via markKycComplete → updateMany.
    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const updateCall = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { user: { id: string }; kycStatus: string };
      data: { kycStatus: string };
    };
    expect(updateCall.where.user.id).toBe("user_abc");
    expect(updateCall.where.kycStatus).toBe("pending");
    expect(updateCall.data.kycStatus).toBe("approved");
  });

  it("returns 400 when payload shape is invalid", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const badBody = JSON.stringify({ malformed: true });
    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, badBody),
      },
      body: badBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when SUMSUB_WEBHOOK_SECRET is not set", async () => {
    delete process.env.SUMSUB_WEBHOOK_SECRET;
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: APPROVED_PAYLOAD,
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // RED review is archived but never auto-rejects (admin-only rejection)
  // ---------------------------------------------------------------------------

  it("archives a RED review without approving or rejecting the investor", async () => {
    const redPayload = JSON.stringify({
      type: "applicantReviewed",
      applicantId: "appl_test123",
      externalUserId: "user_abc",
      reviewResult: { reviewAnswer: "RED" },
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, redPayload),
      },
      body: redPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);

    // Event archived with status "rejected" but NO investor mutation.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { status: string; userId: string };
    };
    expect(createCall.data.status).toBe("rejected");
    expect(createCall.data.userId).toBe("user_abc");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("archives an in-progress event (applicantPending) without approving", async () => {
    const pendingPayload = JSON.stringify({
      type: "applicantPending",
      applicantId: "appl_test123",
      externalUserId: "user_abc",
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, pendingPayload),
      },
      body: pendingPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { status: string };
    };
    expect(createCall.data.status).toBe("applicantPending");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Reset / deleted lifecycle events never approve (invariant lock)
  // ---------------------------------------------------------------------------

  it.each(["applicantReset", "applicantDeleted", "applicantOnHold"])(
    "archives a %s event verbatim without approving the investor",
    async (eventType) => {
      const payload = JSON.stringify({
        type: eventType,
        applicantId: "appl_test123",
        externalUserId: "user_abc",
      });

      const { POST } = await import("../webhook/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost/api/sumsub/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-payload-digest": buildDigest(SECRET, payload),
        },
        body: payload,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockCreate).toHaveBeenCalledOnce();
      const createCall = mockCreate.mock.calls[0]?.[0] as {
        data: { status: string };
      };
      // Non-review events are archived under their raw Sumsub type…
      expect(createCall.data.status).toBe(eventType);
      // …and NEVER move the investor to approved.
      expect(mockUpdateMany).not.toHaveBeenCalled();
    },
  );

  // ---------------------------------------------------------------------------
  // Idempotence — duplicate delivery (P2002)
  // ---------------------------------------------------------------------------

  it("returns 200 { status: 'duplicate' } and replays markKycComplete on duplicate GREEN with claim present", async () => {
    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValueOnce(p2002Error);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, APPROVED_PAYLOAD),
      },
      body: APPROVED_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; applicantId: string };
    expect(json.status).toBe("duplicate");
    expect(json.applicantId).toBe("appl_test123");

    // markKycComplete replayed → investor.updateMany called.
    expect(mockUpdateMany).toHaveBeenCalledOnce();
  });

  it("does NOT replay markKycComplete on a duplicate non-GREEN event", async () => {
    const redPayload = JSON.stringify({
      type: "applicantReviewed",
      applicantId: "appl_test123",
      externalUserId: "user_abc",
      reviewResult: { reviewAnswer: "RED" },
    });
    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValueOnce(p2002Error);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, redPayload),
      },
      body: redPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("duplicate");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Unclaimed applicant — P0-4 spoof defence
  // ---------------------------------------------------------------------------

  it("returns 200 { status: 'unclaimed_inquiry' } and persists sentinel KycEvent without approving when no claim exists (GREEN)", async () => {
    const payloadNoClaim = JSON.stringify({
      type: "applicantReviewed",
      applicantId: "appl_noclaim",
      externalUserId: "attacker_user",
      reviewResult: { reviewAnswer: "GREEN" },
    });

    mockInquiryFindUnique.mockResolvedValue(null);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, payloadNoClaim),
      },
      body: payloadNoClaim,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; applicantId: string };
    expect(json.status).toBe("unclaimed_inquiry");
    expect(json.applicantId).toBe("appl_noclaim");

    // Sentinel KycEvent persisted (userId="unclaimed"), no approval.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { userId: string; inquiryId: string };
    };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(createCall.data.inquiryId).toBe("appl_noclaim");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("P0-4 spoof: rejects approval when payload echoes a victim externalUserId but no server claim exists", async () => {
    const spoofPayload = JSON.stringify({
      type: "applicantReviewed",
      applicantId: "appl_spoof",
      externalUserId: "victim_user",
      reviewResult: { reviewAnswer: "GREEN" },
    });

    mockInquiryFindUnique.mockResolvedValue(null);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, spoofPayload),
      },
      body: spoofPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("unclaimed_inquiry");

    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as { data: { userId: string } };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("P0-4 claim mismatch: KycEvent uses the real owner userId, never the payload externalUserId", async () => {
    const mismatchPayload = JSON.stringify({
      type: "applicantReviewed",
      applicantId: "appl_mismatch",
      externalUserId: "attacker", // untrusted hint
      reviewResult: { reviewAnswer: "GREEN" },
    });

    mockInquiryFindUnique.mockResolvedValue({
      inquiryId: "appl_mismatch",
      userId: "real_owner",
      createdAt: new Date(),
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/sumsub/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payload-digest": buildDigest(SECRET, mismatchPayload),
      },
      body: mismatchPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { userId: string; inquiryId: string };
    };
    expect(createCall.data.userId).toBe("real_owner");
    expect(createCall.data.inquiryId).toBe("appl_mismatch");
    // Approval resolves through markKycComplete (which uses the claim).
    expect(mockUpdateMany).toHaveBeenCalledOnce();
  });
});
