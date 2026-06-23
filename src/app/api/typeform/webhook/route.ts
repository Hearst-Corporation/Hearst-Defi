/**
 * Typeform webhook receiver — onboarding qualification questionnaire.
 *
 * Typeform POSTs a `form_response` payload whenever the lead-qualification
 * form (form.typeform.com/to/NXUw7yzJ) is submitted. We validate the HMAC-SHA256
 * signature against `TYPEFORM_WEBHOOK_SECRET`, parse the structured answers
 * (see lib/agents/qualification.ts), upsert a `QualificationProfile` (matched by
 * email), and — when the email already maps to a User — recalibrate that user's
 * cockpit-chat agent persona.
 *
 * Security:
 *   - HMAC-SHA256 over the RAW request body, Base64-encoded.
 *   - Typeform sends it in the `Typeform-Signature: sha256=<base64>` header.
 *   - Fail closed when the secret is not configured.
 *
 * Reference: https://www.typeform.com/developers/webhooks/secure-your-webhooks/
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  parseTypeformPayload,
  upsertQualification,
  applyCalibrationToUser,
  createInvestorFromWebhook,
  type TypeformWebhookPayload,
} from "@/lib/agents/qualification";
import { sendWelcomeEmail } from "@/lib/auth/send-welcome-email";
import { upsertHubSpotContact } from "@/lib/hubspot/sync-qualification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB — questionnaire payloads are small
const SIGNATURE_HEADER = "typeform-signature";

/**
 * Validates the Typeform signature `sha256=<base64>` over the raw body.
 * Exported for unit testing.
 */
export function validateTypeformHmac(
  secret: string,
  rawBody: string,
  header: string,
): boolean {
  if (!header) return false;
  const received = header.startsWith("sha256=") ? header.slice(7) : header;
  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(received, "utf8");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

function parseBody(raw: string): TypeformWebhookPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as TypeformWebhookPayload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await request.text();

  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[typeform/webhook] TYPEFORM_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get(SIGNATURE_HEADER) ?? "";
  if (!validateTypeformHmac(secret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = parseBody(rawBody);
  if (!payload || !payload.form_response) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = parseTypeformPayload(payload);

  // Match the submission to an existing account by email (the form may be
  // filled before the account exists — userId stays null until then).
  let userId: string | null = null;
  if (parsed.email) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const qualification = await upsertQualification({
    userId,
    email: parsed.email,
    source: "typeform",
    rawPayload: payload,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    phone: parsed.phone,
    website: parsed.website,
    ...parsed.answers,
  });

  // Auto-create investor account when this email is unknown.
  if (!userId && parsed.email) {
    try {
      const created = await createInvestorFromWebhook(parsed.email);
      if (created) {
        userId = created.userId;
        // Link the EXACT qualification row we just upserted to the new user, by
        // its id — not a second email-based updateMany. updateMany could match
        // zero rows (a duplicate-orphan with the same email already linked, or a
        // normalization mismatch between the stored email and the one passed to
        // createInvestorFromWebhook); calibration below does findUnique(userId)
        // and would then silently no-op, leaving the new investor uncalibrated.
        await prisma.qualificationProfile.update({
          where: { id: qualification.id },
          data: { userId: created.userId },
        });
        // Send welcome / account-activation email (best-effort, non-blocking).
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        after(() =>
          sendWelcomeEmail({
            userId: created.userId,
            email: parsed.email!,
            firstName: parsed.firstName,
            appUrl,
          }).catch((err) =>
            console.error("[typeform/webhook] welcome email failed", err),
          ),
        );
      }
    } catch (err) {
      console.error("[typeform/webhook] auto-create investor failed", err);
    }
  }

  // Calibrate agent from questionnaire answers (best-effort).
  if (userId) {
    try {
      await applyCalibrationToUser(userId);
    } catch (err) {
      console.error("[typeform/webhook] calibration failed", err);
    }
  }

  // Sync contact to HubSpot (best-effort, non-blocking).
  if (parsed.email && qualification) {
    after(() =>
      upsertHubSpotContact(userId, qualification).catch((err) =>
        console.error("[typeform/webhook] hubspot sync failed", err),
      ),
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
