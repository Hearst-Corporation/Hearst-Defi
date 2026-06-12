/**
 * POST /api/persona/webhook — unit tests
 *
 * Tests HMAC verification, payload parsing, and KycEvent persistence
 * without hitting a real database (prisma is mocked).
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

function buildSignature(secret: string, timestamp: string, body: string): string {
  const signedPayload = `${timestamp}.${body}`;
  const v1 = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}


const VALID_PAYLOAD = JSON.stringify({
  data: {
    id: "inq_test123",
    type: "inquiry",
    attributes: {
      status: "completed",
      "reference-id": "user_abc",
    },
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/persona/webhook", () => {
  const SECRET = "test-webhook-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PERSONA_WEBHOOK_SECRET = SECRET;
    // Default: the inquiry is claimed by "user_abc" (happy path)
    mockInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_test123",
      userId: "user_abc",
      createdAt: new Date(),
    });
  });

  it("returns 413 when content-length exceeds 1 MB (before HMAC check)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Declare a body size just over 1 MB — body is not actually that large
        // (the guard rejects based on the header, before buffering).
        "content-length": String(1_000_001),
      },
      body: VALID_PAYLOAD,
    });
    const res = await POST(nextReq);
    expect(res.status).toBe(413);
    // HMAC check and DB were never reached
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when Persona-Signature header is missing", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const nextReq = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: VALID_PAYLOAD,
    });
    const res = await POST(nextReq);
    expect(res.status).toBe(401);
  });

  it("returns 401 when signature is invalid", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": "t=1234567890,v1=badhex",
      },
      body: VALID_PAYLOAD,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and persists KycEvent with userId from the KycInquiry claim (not the payload reference-id)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, VALID_PAYLOAD);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: VALID_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);

    // KycEvent should have been created
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { inquiryId: string; status: string; userId: string };
    };
    expect(createCall.data.inquiryId).toBe("inq_test123");
    expect(createCall.data.status).toBe("completed");
    // userId comes from the KycInquiry claim, not the payload reference-id
    expect(createCall.data.userId).toBe("user_abc");
  });

  it("returns 400 when payload shape is invalid", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const badBody = JSON.stringify({ malformed: true });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, badBody);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: badBody,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when timestamp is too old (> 300 s)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    // Timestamp 10 minutes in the past — outside the 5-minute tolerance
    const staleTs = String(Math.floor(Date.now() / 1000) - 601);
    const sig = buildSignature(SECRET, staleTs, VALID_PAYLOAD);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: VALID_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when timestamp is too far in the future (> 300 s)", async () => {
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    // Timestamp 10 minutes in the future — outside the 5-minute tolerance
    const futureTs = String(Math.floor(Date.now() / 1000) + 601);
    const sig = buildSignature(SECRET, futureTs, VALID_PAYLOAD);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: VALID_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when PERSONA_WEBHOOK_SECRET is not set", async () => {
    delete process.env.PERSONA_WEBHOOK_SECRET;
    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: VALID_PAYLOAD,
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 { status: 'duplicate' } and replays markKycComplete when terminal status + claim present (B1-D recovery)", async () => {
    // Simulate Prisma P2002 unique constraint violation on duplicate delivery.
    // beforeEach sets mockInquiryFindUnique to return a valid claim ("user_abc").
    // After the fix the duplicate path MUST replay markKycComplete when terminal.
    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValueOnce(p2002Error);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, VALID_PAYLOAD);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: VALID_PAYLOAD,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; inquiryId: string };
    expect(json.status).toBe("duplicate");
    expect(json.inquiryId).toBe("inq_test123");

    // markKycComplete was replayed → investor.updateMany WAS called (B1-D fix).
    expect(mockUpdateMany).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // B1-D: TOCTOU recovery tests
  // ---------------------------------------------------------------------------

  it("B1-D recovery: redelivery on duplicate inquiryId with terminal status + claim now present → replays markKycComplete (investor approved)", async () => {
    // Scenario D interleave:
    // 1. First delivery wrote sentinel KycEvent (userId="unclaimed").
    // 2. claimKycInquiry wrote KycInquiry for "real_user".
    // 3. Redelivery arrives: kycEvent.create raises P2002 (sentinel row exists).
    //    At this point a claim IS present — rattrapage must fire.
    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValueOnce(p2002Error);

    // Claim is present now (written by claimKycInquiry between deliveries).
    mockInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_test123",
      userId: "real_user",
      createdAt: new Date(),
    });

    const payload = JSON.stringify({
      data: {
        id: "inq_test123",
        type: "inquiry",
        attributes: { status: "completed", "reference-id": "real_user" },
      },
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, payload);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; inquiryId: string };
    // Response is still "duplicate" — correct
    expect(json.status).toBe("duplicate");
    expect(json.inquiryId).toBe("inq_test123");

    // markKycComplete replayed → investor approved via updateMany
    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const updateCall = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { user: { id: string }; kycStatus: string };
      data: { kycStatus: string };
    };
    expect(updateCall.where.user.id).toBe("real_user");
    expect(updateCall.where.kycStatus).toBe("pending");
    expect(updateCall.data.kycStatus).toBe("approved");
  });

  it("B1-D no recovery when no claim on duplicate path: 200 duplicate, markKycComplete not called", async () => {
    // Scenario: kycEvent.create raises P2002 (claimed path entered because the
    // first findUnique returned a claim), but the second findUnique inside the
    // P2002 recovery returns null (claim vanished — edge case or test harness).
    // No rattrapage — investor is not approved.
    const p2002Error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValueOnce(p2002Error);

    // First call (line 145 — enter claimed path): claim present so we reach kycEvent.create.
    // Second call (P2002 recovery): claim absent → no markKycComplete.
    mockInquiryFindUnique
      .mockResolvedValueOnce({
        inquiryId: "inq_noclaim",
        userId: "some_user",
        createdAt: new Date(),
      })
      .mockResolvedValueOnce(null);

    const payload = JSON.stringify({
      data: {
        id: "inq_noclaim",
        type: "inquiry",
        attributes: { status: "completed", "reference-id": "some_user" },
      },
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, payload);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; inquiryId: string };
    expect(json.status).toBe("duplicate");
    expect(json.inquiryId).toBe("inq_noclaim");

    // Second findUnique returned null → no approval attempt
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Unclaimed inquiry (replaces the old missing_reference_id tests — P0-4)
  // ---------------------------------------------------------------------------

  it("returns 200 { status: 'unclaimed_inquiry' } and persists sentinel KycEvent (audit/replay) but does NOT approve when no KycInquiry claim exists (terminal status)", async () => {
    // No server-side claim for this inquiry — simulates a webhook racing ahead
    // of claimKycInquiry (B1) or a spoofed/misconfigured flow.
    const payloadNoRef = JSON.stringify({
      data: {
        id: "inq_noref",
        type: "inquiry",
        attributes: {
          status: "completed", // terminal — the dangerous case
          // reference-id present but no claim on server
          "reference-id": "attacker_user",
        },
      },
    });

    // Override default: no claim exists for inq_noref
    mockInquiryFindUnique.mockResolvedValue(null);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, payloadNoRef);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: payloadNoRef,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; inquiryId: string };
    expect(json.status).toBe("unclaimed_inquiry");
    expect(json.inquiryId).toBe("inq_noref");

    // Sentinel KycEvent written for audit/replay — but userId is the non-resolvable
    // sentinel "unclaimed" so markKycComplete can never approve from this path.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { userId: string; inquiryId: string };
    };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(createCall.data.inquiryId).toBe("inq_noref");
    // No approval attempted.
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("treats missing reference-id the same as any unclaimed inquiry (sentinel persisted, no approve)", async () => {
    const payloadBlankRef = JSON.stringify({
      data: {
        id: "inq_blankref",
        type: "inquiry",
        attributes: {
          status: "approved",
          "reference-id": "   ", // whitespace-only — still requires a server claim
        },
      },
    });

    // No claim exists → unclaimed
    mockInquiryFindUnique.mockResolvedValue(null);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, payloadBlankRef);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: payloadBlankRef,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("unclaimed_inquiry");
    // Sentinel KycEvent persisted (userId="unclaimed"), no approval.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as { data: { userId: string } };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // P0-4: spoof defence — attacker sends victim's reference-id but has no claim
  // ---------------------------------------------------------------------------

  it("P0-4 spoof: rejects approval when payload has victim reference-id but no server claim exists", async () => {
    // An attacker launches a Persona inquiry with the victim's userId as
    // reference-id. There is NO KycInquiry row because the victim never started
    // the flow — the attacker did, from a different session.
    const spoofPayload = JSON.stringify({
      data: {
        id: "inq_spoof",
        type: "inquiry",
        attributes: {
          status: "completed",
          "reference-id": "victim_user", // attacker put the victim's id here
        },
      },
    });

    // No server-side claim → attacker cannot hijack victim's KYC approval
    mockInquiryFindUnique.mockResolvedValue(null);

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, spoofPayload);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: spoofPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string; inquiryId: string };
    // Must return unclaimed, never approve the victim
    expect(json.status).toBe("unclaimed_inquiry");
    expect(json.inquiryId).toBe("inq_spoof");

    // Sentinel KycEvent persisted with userId="unclaimed" — never "victim_user".
    // No investor approved.
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as { data: { userId: string } };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // P0-4: claim mismatch — the real owner takes priority over the payload hint
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // B1: unclaimed inquiry persists sentinel KycEvent for audit/replay
  // ---------------------------------------------------------------------------

  it("unclaimed inquiry persists a KycEvent for audit/replay (sentinel userId, no approval)", async () => {
    // B1 scenario: webhook arrives before claimKycInquiry has run.
    // The route must write a KycEvent with userId="unclaimed" (sentinel) so
    // claimKycInquiry can replay the approval later — but must NOT approve now.
    const payload = JSON.stringify({
      data: {
        id: "inq_race",
        type: "inquiry",
        attributes: { status: "completed", "reference-id": "some_user" },
      },
    });

    mockInquiryFindUnique.mockResolvedValue(null); // no claim yet

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, payload);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("unclaimed_inquiry");

    // kycEvent.create MUST have been called with sentinel userId
    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { userId: string; inquiryId: string };
    };
    expect(createCall.data.userId).toBe("unclaimed");
    expect(createCall.data.inquiryId).toBe("inq_race");

    // investor.updateMany must NOT have been called — no approval yet
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("P0-4 claim mismatch: KycEvent is created with the real owner userId, not the payload reference-id", async () => {
    // The attacker supplies reference-id "attacker" in the payload, but the
    // server-side KycInquiry was claimed by "real_owner" (the legitimate user).
    // The webhook must honour the server claim, not the payload hint.
    const mismatchPayload = JSON.stringify({
      data: {
        id: "inq_mismatch",
        type: "inquiry",
        attributes: {
          status: "completed",
          "reference-id": "attacker", // untrusted client-supplied hint
        },
      },
    });

    mockInquiryFindUnique.mockResolvedValue({
      inquiryId: "inq_mismatch",
      userId: "real_owner", // server-authoritative
      createdAt: new Date(),
    });

    const { POST } = await import("../webhook/route");
    const { NextRequest } = await import("next/server");

    const ts = String(Math.floor(Date.now() / 1000));
    const sig = buildSignature(SECRET, ts, mismatchPayload);

    const req = new NextRequest("http://localhost/api/persona/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "persona-signature": sig,
      },
      body: mismatchPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);

    expect(mockCreate).toHaveBeenCalledOnce();
    const createCall = mockCreate.mock.calls[0]?.[0] as {
      data: { userId: string; inquiryId: string };
    };
    // MUST be "real_owner" from the claim, NEVER "attacker" from the payload
    expect(createCall.data.userId).toBe("real_owner");
    expect(createCall.data.inquiryId).toBe("inq_mismatch");
  });
});
