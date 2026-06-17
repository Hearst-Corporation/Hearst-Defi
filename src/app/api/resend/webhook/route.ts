/**
 * Resend tracking webhook receiver.
 *
 * Resend (via Svix) POSTs delivery / engagement events for every email we send
 * through the Outreach module. We correlate each event back to the originating
 * `OutreachEmail` row via `data.email_id` (stored as `resendEmailId`), append an
 * `OutreachEmailEvent`, and forward-progress the email + prospect status.
 *
 * Security:
 *   - Svix signature validation over the raw body using `RESEND_WEBHOOK_SECRET`.
 *     The secret is fetched from env; if absent we fail closed (503).
 *   - Invalid signature → 401.
 *
 * Reliability:
 *   - Every other outcome returns 200 so Resend does NOT retry. Internal errors
 *     are logged and still answered 200 to avoid retry storms (the event is
 *     idempotent-friendly: a replay simply appends another event row, and the
 *     status transition is monotonic).
 *
 * Reference:
 *   https://resend.com/docs/dashboard/webhooks/introduction
 */

import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { validateResendSignature } from "@/lib/email/resend-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Event shape — typed without `any`
// ---------------------------------------------------------------------------

/**
 * Resend event types we react to. Resend prefixes every type with `email.`;
 * our internal `OutreachEmailEvent.type` strips that prefix.
 */
const RESEND_EVENT_TYPES = [
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
] as const;

type ResendEventType = (typeof RESEND_EVENT_TYPES)[number];

/** Our internal event/status vocabulary (the `email.` prefix removed). */
type OutreachEventType =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

interface ResendEventData {
  email_id?: string;
  click?: {
    link?: string;
  };
  [key: string]: unknown;
}

interface ResendEvent {
  type?: string;
  data?: ResendEventData;
  [key: string]: unknown;
}

function parseEvent(raw: string): ResendEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ResendEvent;
  } catch {
    return null;
  }
}

function isResendEventType(type: string | undefined): type is ResendEventType {
  return (
    typeof type === "string" &&
    (RESEND_EVENT_TYPES as readonly string[]).includes(type)
  );
}

/** Strip the `email.` prefix → our internal event type. */
function toOutreachEventType(type: ResendEventType): OutreachEventType {
  return type.slice("email.".length) as OutreachEventType;
}

// ---------------------------------------------------------------------------
// Status progression
// ---------------------------------------------------------------------------

/**
 * Forward-progression rank for the engagement funnel. A status only advances
 * when the incoming event ranks strictly higher than the stored status, which
 * makes out-of-order webhook delivery safe (an `opened` arriving after a
 * `clicked` will not regress the row).
 *
 * `bounced` / `complained` are terminal: once set they outrank everything and
 * no further event can move the row.
 */
const PROGRESS_RANK: Record<string, number> = {
  draft: 0,
  approved: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  bounced: 99,
  complained: 99,
};

function rankOf(status: string): number {
  return PROGRESS_RANK[status] ?? 0;
}

/** Whether the incoming event should advance the email status. */
function isForwardProgression(
  current: string,
  next: OutreachEventType,
): boolean {
  // A terminal current status can never be advanced.
  if (current === "bounced" || current === "complained") return false;
  return rankOf(next) > rankOf(current);
}

/** Map an event to a prospect-level status, when one applies. */
function prospectStatusFor(event: OutreachEventType): string | null {
  if (event === "opened") return "opened";
  if (event === "bounced") return "bounced";
  return null;
}

// ---------------------------------------------------------------------------
// Best-effort HubSpot activity logging
// ---------------------------------------------------------------------------

/**
 * Logs the engagement event on the prospect's HubSpot contact as a Note.
 * Best-effort: any failure (missing key, network, missing contact) is swallowed
 * — webhook processing must never fail because of CRM side effects.
 *
 * Only `opened` / `clicked` / `bounced` are worth recording on the timeline.
 */
async function logHubSpotActivity(
  email: string,
  event: OutreachEventType,
  url: string | null,
): Promise<void> {
  if (event !== "opened" && event !== "clicked" && event !== "bounced") return;

  try {
    // Dynamic import keeps the server-only HubSpot module out of any path that
    // might be statically analysed for the client bundle.
    const hubspot = await import("@/lib/hubspot/client");
    const contact = await hubspot.getContactByEmail(email);
    if (!contact) return;

    const lines = [`Outreach email ${event}.`];
    if (url) lines.push(`Link: ${url}`);
    lines.push(`Recorded ${new Date().toISOString()} via Resend webhook.`);

    await hubspot.createNote(contact.id, lines.join("\n"));
  } catch (err) {
    console.error("[resend/webhook] HubSpot activity log failed", err);
  }
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function processEvent(rawEvent: ResendEvent): Promise<void> {
  if (!isResendEventType(rawEvent.type)) return;

  const eventType = toOutreachEventType(rawEvent.type);
  const emailId = rawEvent.data?.email_id;
  if (!emailId) return;

  const outreachEmail = await prisma.outreachEmail.findUnique({
    where: { resendEmailId: emailId },
    select: { id: true, status: true, toEmail: true, prospectId: true },
  });
  if (!outreachEmail) return;

  const url = rawEvent.data?.click?.link ?? null;

  // 1. Append the event row (raw payload retained for audit/debug).
  await prisma.outreachEmailEvent.create({
    data: {
      emailId: outreachEmail.id,
      type: eventType,
      url,
      raw: rawEvent as Prisma.InputJsonValue,
    },
  });

  // 2. Forward-progress the email status when applicable.
  if (isForwardProgression(outreachEmail.status, eventType)) {
    await prisma.outreachEmail.update({
      where: { id: outreachEmail.id },
      data: { status: eventType },
    });
  }

  // 3. Forward-progress the linked prospect status when applicable.
  const prospectStatus = prospectStatusFor(eventType);
  if (prospectStatus && outreachEmail.prospectId) {
    const prospect = await prisma.outreachProspect.findUnique({
      where: { id: outreachEmail.prospectId },
      select: { id: true, status: true },
    });

    // Never regress a prospect already past this point (e.g. replied/qualified)
    // and never override a terminal bounce.
    if (prospect && prospect.status !== "bounced") {
      if (prospectStatus === "bounced" || prospect.status === "new") {
        await prisma.outreachProspect.update({
          where: { id: prospect.id },
          data: { status: prospectStatus },
        });
      } else if (
        prospectStatus === "opened" &&
        (prospect.status === "contacted" || prospect.status === "new")
      ) {
        await prisma.outreachProspect.update({
          where: { id: prospect.id },
          data: { status: prospectStatus },
        });
      }
    }
  }

  // 4. Best-effort CRM logging.
  await logHubSpotActivity(outreachEmail.toEmail, eventType, url);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body (required for Svix signature verification before parse).
  const rawBody = await request.text();

  // 2. Config check — fail closed if the secret is not provisioned.
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend/webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  // 3. Svix signature validation.
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  const valid = validateResendSignature({
    secret,
    payload: rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 4. Process. Any internal failure is logged and answered 200 so Resend
  //    does not enter a retry storm.
  try {
    const event = parseEvent(rawBody);
    if (event) {
      await processEvent(event);
    }
  } catch (err) {
    console.error("[resend/webhook] processing failed", err);
  }

  return NextResponse.json({ ok: true });
}
