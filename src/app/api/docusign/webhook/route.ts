/**
 * DocuSign Connect webhook receiver.
 *
 * DocuSign sends a POST to this endpoint whenever envelope events occur.
 * We validate the HMAC-SHA256 signature using the `DOCUSIGN_WEBHOOK_SECRET`
 * env var (configured in the DocuSign Connect admin panel), then update the
 * `SubscriptionEnvelope` row in the DB.
 *
 * Security:
 *   - HMAC-SHA256 over the raw request body using the shared secret.
 *   - DocuSign sends the digest in the `X-DocuSign-Signature-1` header,
 *     Base64-encoded.
 *   - Body size limit: 10 MB (DocuSign events can carry embedded documents).
 *
 * Reference:
 *   https://developers.docusign.com/platform/webhooks/connect/hmac/
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const SIGNATURE_HEADER = "x-docusign-signature-1";

// ---------------------------------------------------------------------------
// HMAC validation
// ---------------------------------------------------------------------------

/**
 * Validates the DocuSign HMAC-SHA256 signature.
 *
 * @param secret    - Raw HMAC secret from `DOCUSIGN_WEBHOOK_SECRET`.
 * @param rawBody   - The raw UTF-8 request body (must be read before parsing).
 * @param signature - Base64-encoded signature from the request header.
 * @returns `true` if the signature is valid; `false` otherwise.
 */
export function validateDocusignHmac(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  if (!signature) return false;

  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(signature, "utf8");

    // Constant-time comparison to prevent timing attacks
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event payload types — minimal, typed without `any`
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a DocuSign Connect event payload (JSON format).
 * DocuSign can send XML or JSON depending on Connect configuration.
 * We enforce JSON in the Connect setup and parse only the fields we need.
 */
interface DocusignEventPayload {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      completedDateTime?: string;
      documentsUri?: string;
    };
  };
}

function parsePayload(raw: string): DocusignEventPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as DocusignEventPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body (needed for HMAC validation before JSON.parse)
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await request.text();

  // 2. Validate HMAC signature
  const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Misconfiguration — fail closed rather than accept unsigned events
    console.error("[docusign/webhook] DOCUSIGN_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get(SIGNATURE_HEADER) ?? "";
  if (!validateDocusignHmac(webhookSecret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse event payload
  const payload = parsePayload(rawBody);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const event = payload.event;
  const envelopeId = payload.data?.envelopeId;
  const summary = payload.data?.envelopeSummary;

  if (!envelopeId) {
    // Acknowledge — we don't crash on unknown payload shapes
    return NextResponse.json({ received: true });
  }

  // 4. Handle envelope-completed event
  if (event === "envelope-completed") {
    const signedAt = summary?.completedDateTime
      ? new Date(summary.completedDateTime)
      : new Date();

    const documentUrl = summary?.documentsUri ?? null;

    await prisma.subscriptionEnvelope.updateMany({
      where: { envelopeId },
      data: {
        status: "completed",
        signedAt,
        ...(documentUrl ? { documentUrl } : {}),
      },
    });

    return NextResponse.json({ received: true, action: "envelope-completed" });
  }

  // 5. Handle other terminal statuses (declined, voided)
  if (event === "envelope-declined" || event === "envelope-voided") {
    const newStatus = event === "envelope-declined" ? "declined" : "voided";

    await prisma.subscriptionEnvelope.updateMany({
      where: { envelopeId },
      data: { status: newStatus },
    });

    return NextResponse.json({ received: true, action: event });
  }

  // 6. All other events — acknowledge without DB write
  return NextResponse.json({ received: true });
}
