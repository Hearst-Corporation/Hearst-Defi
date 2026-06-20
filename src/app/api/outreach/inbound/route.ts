/**
 * Outreach inbound reply receiver (Palier 4 — closed loop, ADR-016).
 *
 * Resend Inbound (via Svix) POSTs an inbound email event when someone replies to
 * an outreach address. We:
 *   1. Validate the Svix signature over the raw body (RESEND_WEBHOOK_SECRET) —
 *      fail closed (503 if no secret, 401 on bad signature).
 *   2. Extract from-address + subject + text body.
 *   3. Match the OutreachProspect by from-address (best-effort; unmatched replies
 *      are still recorded for audit).
 *   4. Persist an OutreachReply, classify it with the reply-handler agent, and
 *      execute the BOUNDED action (suppress / promote tier / qualify / stop
 *      cadence) — never an outbound send from here.
 *
 * Reliability: every non-signature outcome returns 200 so Resend does not retry
 * (the work is idempotent-friendly — a replay records another reply row and the
 * status transitions are monotonic / safe).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { validateResendSignature } from "@/lib/email/resend-signature";
import {
  classifyReply,
  actionForIntent,
} from "@/lib/agents/outreach-reply-handler";
import { isTier, promoteTier } from "@/lib/outreach/tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InboundPayload {
  from?: string | { email?: string };
  subject?: string;
  text?: string;
  html?: string;
  [key: string]: unknown;
}

interface InboundEvent {
  type?: string;
  data?: InboundPayload;
  [key: string]: unknown;
}

/** Pull a plain email address out of "Name <addr@x>" or a raw address. */
function extractAddress(from: InboundPayload["from"]): string | null {
  if (!from) return null;
  const raw = typeof from === "string" ? from : from.email ?? "";
  const match = raw.match(/<([^>]+)>/);
  const addr = (match?.[1] ?? raw).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("[outreach/inbound] RESEND_WEBHOOK_SECRET unset — failing closed");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const valid = validateResendSignature({
    secret,
    payload: rawBody,
    svixId: request.headers.get("svix-id") ?? "",
    svixTimestamp: request.headers.get("svix-timestamp") ?? "",
    svixSignature: request.headers.get("svix-signature") ?? "",
  });
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: InboundEvent;
  try {
    event = JSON.parse(rawBody) as InboundEvent;
  } catch {
    // Malformed body — ack so Resend stops retrying; nothing to do.
    return NextResponse.json({ ok: true, skipped: "unparseable" });
  }

  const data = event.data ?? {};
  const fromEmail = extractAddress(data.from);
  if (!fromEmail) {
    return NextResponse.json({ ok: true, skipped: "no_from" });
  }

  const body = (data.text ?? "").trim() || stripHtml(data.html ?? "");
  const subject = (data.subject ?? "").trim() || null;

  try {
    // Match the prospect by from-address (may be null — still record the reply).
    const prospect = await prisma.outreachProspect.findUnique({
      where: { email: fromEmail },
      select: { id: true, tier: true, status: true },
    });

    // Record the raw reply first (so it's never lost even if classify fails).
    const reply = await prisma.outreachReply.create({
      data: {
        prospectId: prospect?.id ?? null,
        fromEmail,
        subject,
        body,
        raw: event as object,
      },
      select: { id: true },
    });

    // Classify with the reply-handler agent.
    const classification = await classifyReply({ fromEmail, subject, body });
    const outcome = actionForIntent(classification.intent);

    // Execute the bounded action.
    if (outcome.suppress) {
      await prisma.outreachSuppression.upsert({
        where: { email: fromEmail },
        update: {
          reason: classification.intent === "bounce" ? "bounce" : "opt_out",
          until: null,
        },
        create: {
          email: fromEmail,
          reason: classification.intent === "bounce" ? "bounce" : "opt_out",
          until: null,
        },
      });
      await prisma.outreachProspect.updateMany({
        where: { email: fromEmail },
        data: { status: "opted_out" },
      });
    } else if (prospect) {
      const data_: {
        status?: string;
        tier?: string;
        sequenceStep?: number;
      } = {};
      if (outcome.qualify) data_.status = "qualified";
      else if (classification.intent === "interested") data_.status = "replied";
      if (outcome.promote && isTier(prospect.tier)) {
        data_.tier = promoteTier(prospect.tier);
      }
      // Stopping the cadence: push sequenceStep past the max so followups skip it.
      if (outcome.stopCadence) data_.sequenceStep = 99;
      if (Object.keys(data_).length > 0) {
        await prisma.outreachProspect.update({
          where: { id: prospect.id },
          data: data_,
        });
      }
    }

    // Annotate the reply with the classifier result + action for audit.
    await prisma.outreachReply.update({
      where: { id: reply.id },
      data: {
        intent: classification.intent,
        confidence: classification.confidence,
        actionTaken: outcome.action,
        handledAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      intent: classification.intent,
      action: outcome.action,
    });
  } catch (err) {
    logger.error("[outreach/inbound] processing failed", {
      fromEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    // Ack anyway — the raw reply is persisted; reclassification can be retried.
    return NextResponse.json({ ok: true, deferred: true });
  }
}

/** Minimal HTML→text fallback when an inbound has no plaintext part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
