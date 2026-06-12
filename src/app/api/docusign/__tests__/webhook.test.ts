/**
 * DocuSign webhook route — Vitest unit tests.
 *
 * All Prisma calls are mocked. No real DB or HTTP calls.
 *
 * Coverage:
 *   1. validateDocusignHmac: valid signature returns true.
 *   2. validateDocusignHmac: wrong signature returns false.
 *   3. validateDocusignHmac: empty signature returns false.
 *   4. POST with valid HMAC + envelope-completed → updates DB, returns 200.
 *   5. POST with invalid HMAC → 401.
 *   6. POST with missing webhook secret env var → 503.
 *   7. POST with envelope-declined → updates DB to "declined".
 *   8. POST with unknown event → 200 (acknowledge only, no DB write).
 *   9. POST with missing envelopeId → 200 (acknowledge only).
 */

import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before importing the module under test
// ---------------------------------------------------------------------------

const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

vi.mock("@/lib/db", () => ({
  prisma: {
    subscriptionEnvelope: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import { POST, validateDocusignHmac } from "@/app/api/docusign/webhook/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = "test-webhook-secret";

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

function buildRequest(body: string, signature: string, secret?: string): NextRequest {
  const url = "https://connect.hearst.app/api/docusign/webhook";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    "x-docusign-signature-1": signature,
  };
  const req = new NextRequest(url, {
    method: "POST",
    body,
    headers,
  });

  // Override env via closure for this request's handling
  if (secret !== undefined) {
    process.env.DOCUSIGN_WEBHOOK_SECRET = secret;
  }

  return req;
}

function envelopeCompletedPayload(envelopeId = "env-test-123") {
  return JSON.stringify({
    event: "envelope-completed",
    data: {
      envelopeId,
      envelopeSummary: {
        status: "completed",
        completedDateTime: "2026-05-26T12:00:00.000Z",
        documentsUri: "/envelopes/env-test-123/documents",
      },
    },
  });
}

// ---------------------------------------------------------------------------
// validateDocusignHmac unit tests
// ---------------------------------------------------------------------------

describe("validateDocusignHmac", () => {
  it("returns true for a valid HMAC signature", () => {
    const body = '{"event":"envelope-completed"}';
    const sig = sign(SECRET, body);
    expect(validateDocusignHmac(SECRET, body, sig)).toBe(true);
  });

  it("returns false for a wrong signature", () => {
    const body = '{"event":"envelope-completed"}';
    expect(validateDocusignHmac(SECRET, body, "wrongsignature==")).toBe(false);
  });

  it("returns false for an empty signature", () => {
    const body = '{"event":"envelope-completed"}';
    expect(validateDocusignHmac(SECRET, body, "")).toBe(false);
  });

  it("returns false when body is tampered", () => {
    const body = '{"event":"envelope-completed"}';
    const sig = sign(SECRET, body);
    expect(validateDocusignHmac(SECRET, '{"event":"tampered"}', sig)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST handler tests
// ---------------------------------------------------------------------------

describe("POST /api/docusign/webhook", () => {
  const originalSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = SECRET;
    mockUpdateMany.mockClear();
  });

  afterEach(() => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it("returns 200 and updates DB on valid envelope-completed event", async () => {
    const body = envelopeCompletedPayload("env-complete-1");
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    const json = await res.json() as { received: boolean; action: string };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(json.action).toBe("envelope-completed");

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ envelopeId: "env-complete-1" }),
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("returns 401 on invalid HMAC signature", async () => {
    const body = envelopeCompletedPayload();
    const req = buildRequest(body, "invalidsig==");

    const res = await POST(req);
    const json = await res.json() as { error: string };

    expect(res.status).toBe(401);
    expect(json.error).toBe("Invalid signature");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 503 when DOCUSIGN_WEBHOOK_SECRET is missing", async () => {
    delete process.env.DOCUSIGN_WEBHOOK_SECRET;

    const body = envelopeCompletedPayload();
    const req = buildRequest(body, "doesnt-matter");

    const res = await POST(req);
    const json = await res.json() as { error: string };

    expect(res.status).toBe(503);
    expect(json.error).toBe("Webhook not configured");
  });

  it("updates status to 'declined' on envelope-declined event", async () => {
    const body = JSON.stringify({
      event: "envelope-declined",
      data: { envelopeId: "env-declined-1" },
    });
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ envelopeId: "env-declined-1" }),
        data: { status: "declined" },
      }),
    );
  });

  it("updates status to 'voided' on envelope-voided event", async () => {
    const body = JSON.stringify({
      event: "envelope-voided",
      data: { envelopeId: "env-voided-1" },
    });
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ envelopeId: "env-voided-1" }),
        data: { status: "voided" },
      }),
    );
  });

  it("returns 200 without DB write for unknown event", async () => {
    const body = JSON.stringify({
      event: "envelope-sent",
      data: { envelopeId: "env-sent-1" },
    });
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    const json = await res.json() as { received: boolean };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 200 without DB write when envelopeId is missing", async () => {
    const body = JSON.stringify({ event: "envelope-completed", data: {} });
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    const json = await res.json() as { received: boolean };

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON payload", async () => {
    const body = "not-valid-json";
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 413 when content-length exceeds 10 MB", async () => {
    const body = envelopeCompletedPayload();
    const sig = sign(SECRET, body);
    const url = "https://connect.hearst.app/api/docusign/webhook";
    const req = new NextRequest(url, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        // Simulate an oversized payload via the Content-Length header
        "content-length": String(11 * 1024 * 1024), // 11 MB > 10 MB limit
        "x-docusign-signature-1": sig,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    // Body was rejected before buffering — no DB interaction
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("replay-safe: re-delivering an envelope-completed event does not re-fire side effects (notIn predicate)", async () => {
    // The route passes status: { notIn: TERMINAL_STATUSES } so a replay on an
    // already-completed envelope matches 0 rows → updateMany is still called
    // but the predicate makes it a no-op in the real DB. We verify the predicate
    // is present on the where clause.
    const body = envelopeCompletedPayload("env-replay-1");
    const sig = sign(SECRET, body);
    const req = buildRequest(body, sig);

    mockUpdateMany.mockResolvedValueOnce({ count: 0 }); // simulate already-terminal
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const call = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { envelopeId: string; status: { notIn: string[] } };
    };
    expect(call.where.envelopeId).toBe("env-replay-1");
    // Must contain the notIn predicate to guard against terminal-state replays
    expect(call.where.status?.notIn).toContain("completed");
    expect(call.where.status?.notIn).toContain("declined");
    expect(call.where.status?.notIn).toContain("voided");
  });
});
