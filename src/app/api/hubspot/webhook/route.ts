/**
 * HubSpot inbound webhook — bidirectional sync.
 *
 * HubSpot sends a POST for each subscribed event (contact.propertyChange,
 * deal.propertyChange). We validate the v3 signature, then route events
 * to the appropriate handler.
 *
 * Signature (HubSpot v3):
 *   HMAC-SHA256 over (clientSecret + requestBody), hex-encoded.
 *   Header: X-HubSpot-Signature-v3 (not the older X-HubSpot-Signature).
 *   Also sends X-HubSpot-Request-Timestamp — we reject requests older than
 *   5 minutes to prevent replay attacks.
 *
 * Reference: https://developers.hubspot.com/docs/api/webhooks
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { HUBSPOT_TO_QUALIFICATION } from "@/lib/hubspot/reverse-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes replay window

// ---------------------------------------------------------------------------
// Signature validation
// ---------------------------------------------------------------------------

/**
 * Validates a HubSpot v3 webhook signature.
 * HubSpot computes: HMAC-SHA256(clientSecret + rawBody), hex-encoded.
 * Exported for unit testing.
 */
export function validateHubSpotSignature(
  clientSecret: string,
  rawBody: string,
  header: string,
  timestampHeader: string,
): boolean {
  if (!header || !timestampHeader) return false;

  // Reject stale requests (replay protection).
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts) || Date.now() - ts > MAX_AGE_MS) return false;

  try {
    const expected = createHmac("sha256", clientSecret)
      .update(clientSecret + rawBody, "utf8")
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(header, "utf8");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

interface HubSpotEvent {
  subscriptionType?: string;
  objectId?: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  eventId?: number;
  occurredAt?: number;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Property mapping (hearst_* → QualificationProfile) is shared with the
// reverse-sync cron in @/lib/hubspot/reverse-map.

async function handleContactPropertyChange(
  event: HubSpotEvent,
): Promise<void> {
  const { propertyName, propertyValue, objectId } = event;
  if (!propertyName || !objectId) return;

  const field = HUBSPOT_TO_QUALIFICATION[propertyName];
  if (!field) return; // not a tracked property — ignore

  // Find the HubSpotSync row for this contact to resolve userId.
  const sync = await prisma.hubSpotSync.findFirst({
    where: { kind: "contact_upsert", hubspotObjectId: String(objectId) },
    select: { userId: true },
  });
  if (!sync) return;

  const value = propertyValue ?? null;
  await prisma.qualificationProfile.updateMany({
    where: { userId: sync.userId },
    data: { [field]: value, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await request.text();

  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[hubspot/webhook] HUBSPOT_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-hubspot-signature-v3") ?? "";
  const timestamp = request.headers.get("x-hubspot-request-timestamp") ?? "";

  if (!validateHubSpotSignature(secret, rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: HubSpotEvent[];
  try {
    const parsed: unknown = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? (parsed as HubSpotEvent[]) : [parsed as HubSpotEvent];
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Process events best-effort (HubSpot retries on non-2xx).
  await Promise.allSettled(
    events.map(async (event) => {
      try {
        if (event.subscriptionType === "contact.propertyChange") {
          await handleContactPropertyChange(event);
        }
        // deal.propertyChange — logged only for now.
      } catch (err) {
        console.error("[hubspot/webhook] event handler failed", {
          subscriptionType: event.subscriptionType,
          err,
        });
      }
    }),
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
