import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { markKycComplete } from "@/lib/onboarding/kyc-complete";
import { verifyWebhookSignature } from "@/lib/onboarding/sumsub";

// ---------------------------------------------------------------------------
// Sumsub webhook payload schema — only the fields we care about.
// Sumsub sends a flat envelope; we validate the minimal surface.
//   type            — e.g. "applicantReviewed" | "applicantCreated" | "applicantPending"
//   applicantId     — Sumsub applicant id (plays the role of the old inquiryId)
//   externalUserId  — OUR id hint (UNTRUSTED — never used to resolve the user)
//   reviewResult    — present on "applicantReviewed"; reviewAnswer GREEN|RED
// ---------------------------------------------------------------------------

const SumsubWebhookSchema = z.object({
  type: z.string().min(1),
  applicantId: z.string().min(1),
  externalUserId: z.string().nullish(),
  reviewResult: z
    .object({
      reviewAnswer: z.string().nullish(),
    })
    .nullish(),
});

type SumsubWebhookPayload = z.infer<typeof SumsubWebhookSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when err is a Prisma unique-constraint violation (P2002). */
function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/** Maps a Sumsub event into a coarse status string archived in KycEvent.status. */
function statusFor(parsed: SumsubWebhookPayload): string {
  if (parsed.type === "applicantReviewed") {
    const answer = parsed.reviewResult?.reviewAnswer?.toUpperCase();
    if (answer === "GREEN") return "approved";
    if (answer === "RED") return "rejected";
    return "reviewed";
  }
  return parsed.type;
}

// ---------------------------------------------------------------------------
// POST /api/sumsub/webhook
// ---------------------------------------------------------------------------

/** Maximum body size accepted before HMAC buffering (1 MB). */
const MAX_BODY_BYTES = 1_000_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Content-length guard — reject oversized bodies BEFORE buffering.
  //    Mirrors the same pattern in src/app/api/docusign/webhook/route.ts.
  const rawContentLength = req.headers.get("content-length");
  if (rawContentLength !== null) {
    const bodySize = parseInt(rawContentLength, 10);
    if (!Number.isNaN(bodySize) && bodySize > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
  }

  // 1. Read raw body — must be done before any parsing (HMAC is over raw bytes).
  const rawBody = await req.text();

  // 2. HMAC validation. SUMSUB_WEBHOOK_SECRET may be absent in dev: when unset
  //    we fail-closed (401) so an unverified event can never approve KYC.
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[sumsub/webhook] SUMSUB_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const digest = req.headers.get("x-payload-digest");
  const digestAlg = req.headers.get("x-payload-digest-alg");
  if (!verifyWebhookSignature(rawBody, digest, secret, digestAlg)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse payload ONCE: `rawJson` is archived verbatim in KycEvent.payload,
  //    `parsed` is the Zod-narrowed view used for logic.
  let rawJson: Prisma.InputJsonObject;
  let parsed: SumsubWebhookPayload;
  try {
    const json: unknown = JSON.parse(rawBody);
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw new Error("payload is not a JSON object");
    }
    rawJson = json as Prisma.InputJsonObject;
    parsed = SumsubWebhookSchema.parse(json);
  } catch (err) {
    console.warn("[sumsub/webhook] Unexpected payload shape:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // applicantId plays the role of the old Persona inquiryId — it is the key on
  // the KycInquiry claim and KycEvent rows.
  const applicantId = parsed.applicantId;
  const status = statusFor(parsed);
  const isApproved =
    parsed.type === "applicantReviewed" &&
    parsed.reviewResult?.reviewAnswer?.toUpperCase() === "GREEN";
  // P0-4: externalUserId is CLIENT-ECHOED and therefore untrusted for security
  // decisions. Kept purely as a hint for logging/ops. The authoritative userId
  // is resolved from KycInquiry below.
  const hintExternalUserId = parsed.externalUserId ?? null;

  // 3b. Resolve authoritative userId from server-side KycInquiry claim.
  //
  // claimKycInquiry() must be called by the onboarding UI (via an authenticated
  // server action) BEFORE the document is uploaded. If no claim exists the
  // applicant is unclaimed — either Sumsub misconfiguration or a spoofed
  // externalUserId attack. We refuse to persist a real userId or approve.
  //
  // Response: 200 (NOT 4xx). The payload is well-formed and HMAC-valid. A 4xx
  // would cause Sumsub to retry indefinitely without fixing the root cause.
  const claim = await prisma.kycInquiry.findUnique({
    where: { inquiryId: applicantId },
  });

  if (!claim) {
    // Unclaimed: no server-side link yet (webhook likely raced ahead of
    // claimKycInquiry). Persist the event for audit + late-claim replay, but
    // DO NOT approve — userId stays a non-resolvable sentinel so markKycComplete
    // can never approve from here (P0-4 preserved). claimKycInquiry replays the
    // approval once the authoritative link is written.
    try {
      await prisma.kycEvent.create({
        data: {
          userId: "unclaimed", // sentinel — never a real User.id
          inquiryId: applicantId,
          status,
          payload: rawJson,
          receivedAt: new Date(),
        },
      });
    } catch (err) {
      // P2002 = duplicate delivery of the same unclaimed applicant — ignore.
      if (!isP2002(err)) {
        console.error(
          "[sumsub/webhook] failed to persist unclaimed KycEvent:",
          err,
        );
      }
    }
    console.error(
      `[sumsub/webhook] unclaimed applicant — no server-side KycInquiry link; ` +
        `refusing to approve. Possible spoofed externalUserId or missing ` +
        `claimKycInquiry() call. ` +
        `applicantId=${applicantId} status=${status} hintExternalUserId=${hintExternalUserId ?? "(none)"}`,
    );
    return NextResponse.json(
      { status: "unclaimed_inquiry", applicantId },
      { status: 200 },
    );
  }

  const userId = claim.userId;

  // 4. Persist event in KycEvent using the AUTHORITATIVE userId from the claim.
  try {
    await prisma.kycEvent.create({
      data: {
        userId,
        inquiryId: applicantId,
        status,
        payload: rawJson,
        receivedAt: new Date(),
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation → duplicate delivery, already processed.
    // Return 200 immediately so Sumsub stops retrying.
    //
    // TOCTOU recovery: on the duplicate path the KycEvent sentinel written by the
    // "unclaimed" branch may have blocked a later redelivery from approving the
    // now-claimed investor. If the event is a GREEN review AND a claim now exists,
    // replay markKycComplete so the investor is not left stuck in "pending".
    // markKycComplete is idempotent: it only transitions pending→approved and
    // resolves the userId from KycInquiry (never from the payload — P0-4 preserved).
    if (isP2002(err)) {
      if (isApproved) {
        const claimNow = await prisma.kycInquiry.findUnique({
          where: { inquiryId: applicantId },
        });
        if (claimNow) {
          try {
            await markKycComplete(applicantId);
          } catch (replayErr) {
            console.error(
              `[sumsub/webhook] replay markKycComplete failed (applicantId=${applicantId}):`,
              replayErr,
            );
          }
        }
      }
      console.info(
        `[sumsub/webhook] Duplicate event ignored (applicantId=${applicantId})`,
      );
      return NextResponse.json(
        { status: "duplicate", applicantId },
        { status: 200 },
      );
    }
    console.error("[sumsub/webhook] Failed to persist KycEvent:", err);
    // Do not return 500 to Sumsub — they retry on non-2xx, which would create
    // duplicates. Log and proceed.
  }

  // 5. Mark KYC complete only on a terminal GREEN review.
  //    RED (rejected) is NOT auto-applied from the webhook: only an admin can
  //    move an investor to rejected (parity with the retired Persona flow). We
  //    just archive the RED event above.
  if (isApproved) {
    try {
      await markKycComplete(applicantId);
    } catch (err) {
      console.error("[sumsub/webhook] markKycComplete failed:", err);
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
