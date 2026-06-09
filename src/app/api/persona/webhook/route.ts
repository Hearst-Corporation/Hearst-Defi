import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { markKycComplete } from "@/app/onboarding/actions";

// ---------------------------------------------------------------------------
// Persona webhook payload schema — only the fields we care about.
// Persona sends a versioned envelope; we validate the minimal surface.
// ---------------------------------------------------------------------------

const PersonaWebhookSchema = z.object({
  data: z.object({
    attributes: z.object({
      status: z.string().min(1),
      "reference-id": z.string().nullish(),
    }),
    id: z.string().min(1), // inquiry ID, e.g. "inq_XXXX"
    type: z.literal("inquiry"),
  }),
  events: z
    .array(
      z.object({
        name: z.string(),
        "occurred-at": z.string(),
      }),
    )
    .optional(),
});

type PersonaWebhookPayload = z.infer<typeof PersonaWebhookSchema>;

// ---------------------------------------------------------------------------
// HMAC signature verification
// Persona signs with SHA-256 HMAC over the raw body.
// Header: `Persona-Signature: t=<ts>,v1=<hex>`
// ---------------------------------------------------------------------------

/** Maximum age (in seconds) accepted for a Persona webhook signature. */
const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  // Parse: "t=1234567890,v1=abcdef…"
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const eqIdx = segment.indexOf("=");
    if (eqIdx === -1) continue;
    const key = segment.slice(0, eqIdx).trim();
    const value = segment.slice(eqIdx + 1).trim();
    parts[key] = value;
  }

  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  // P0₁ — Freshness check: reject replayed signatures older/newer than tolerance
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) return false;

  // Persona signs: "<timestamp>.<rawBody>"
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // P1₁ — Explicit length-check before timingSafeEqual (avoids throw → catch path)
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(v1, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

// ---------------------------------------------------------------------------
// POST /api/persona/webhook
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body — must be done before any parsing
  const rawBody = await req.text();

  // 2. HMAC validation
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[persona/webhook] PERSONA_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("Persona-Signature");
  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse payload
  let parsed: PersonaWebhookPayload;
  try {
    parsed = PersonaWebhookSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    console.warn("[persona/webhook] Unexpected payload shape:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inquiryId = parsed.data.id;
  const status = parsed.data.attributes.status;
  const rawReferenceId = parsed.data.attributes["reference-id"];
  // Normalise: treat null / "" / whitespace-only as "no resolvable user".
  const referenceId =
    typeof rawReferenceId === "string" && rawReferenceId.trim() !== ""
      ? rawReferenceId.trim()
      : null;

  // 3b. No resolvable referenceId → we cannot tie this inquiry to a User.
  //
  // We refuse to fabricate a `userId="unknown"` KycEvent: it carries no business
  // value, pollutes the [userId, receivedAt] index, and — because `inquiryId` is
  // a UNIQUE column — a bogus "unknown" row would block the real, referenceId-
  // bearing event for the same inquiry from ever being inserted (P2002).
  //
  // Critically, a terminal status here would otherwise reach markKycComplete and
  // silently no-op (userId === "unknown"), so the investor is NEVER approved
  // while Persona believes the handoff succeeded. That silent gap is the bug.
  //
  // Response: 200 (NOT 4xx). The payload is well-formed and HMAC-valid; the
  // fault is a Persona template misconfiguration (reference-id not wired). A 4xx
  // would make Persona retry forever without ever fixing the missing field, so
  // we ACK with an explicit machine-readable status and log loudly for ops to
  // investigate — mirroring how duplicate / persist-failure paths also 200+log.
  if (referenceId === null) {
    console.error(
      `[persona/webhook] Missing reference-id — cannot resolve investor. ` +
        `inquiryId=${inquiryId} status=${status}. No KycEvent written, no ` +
        `approval applied. Check the Persona inquiry template wiring.`,
    );
    return NextResponse.json(
      { status: "missing_reference_id", inquiryId },
      { status: 200 },
    );
  }

  // 4. Persist event in KycEvent
  try {
    await prisma.kycEvent.create({
      data: {
        userId: referenceId,
        inquiryId,
        status,
        // Prisma Json accepts `object` directly; we parse then cast via
        // the intermediate `unknown` path to satisfy strict no-any.
        payload: JSON.parse(rawBody) as Parameters<typeof prisma.kycEvent.create>[0]["data"]["payload"],
        receivedAt: new Date(),
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation → duplicate delivery, already processed.
    // Return 200 immediately so Persona stops retrying; do NOT re-run business logic.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      console.info(
        `[persona/webhook] Duplicate event ignored (inquiryId=${inquiryId})`,
      );
      return NextResponse.json(
        { status: "duplicate", inquiryId },
        { status: 200 },
      );
    }
    console.error("[persona/webhook] Failed to persist KycEvent:", err);
    // Do not return 500 to Persona — they retry on non-2xx,
    // which would create duplicates. Log and proceed.
  }

  // 5. Mark KYC complete when Persona reports a terminal approved status
  if (status === "completed" || status === "approved") {
    try {
      await markKycComplete(inquiryId);
    } catch (err) {
      console.error("[persona/webhook] markKycComplete failed:", err);
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
