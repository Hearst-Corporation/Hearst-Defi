import "server-only";

import { prisma } from "@/lib/db";

// =============================================================================
// markKycComplete — Sumsub KYC (INTERNAL server-only function)
// =============================================================================
//
// SECURITY (D1): this function transitions an investor's kycStatus pending→approved.
// It MUST NOT be exposed as a Next.js Server Action — otherwise any logged-in
// investor who learns a claimed applicantId could invoke the action RPC and
// force-approve KYC without Sumsub ever verifying them, bypassing the gate on
// subscribe(). It therefore lives in this plain `server-only` module (no
// "use server" directive) and is imported only by trusted server callers:
//   - src/app/api/sumsub/webhook/route.ts    (HMAC-verified Sumsub webhook)
//   - claimKycInquiry()                      (session-authenticated, in actions.ts)
//
// `server-only` guarantees a build error if this module is ever pulled into a
// client bundle.

/**
 * markKycComplete
 *
 * Called by the Sumsub webhook when an applicant reaches a terminal GREEN
 * review (and replayed by claimKycInquiry on the B1 race).
 *
 * Resolves the userId AUTHORITATIVELY from KycInquiry (created by
 * claimKycInquiry() before the webhook arrives — P0-4 defence).
 * Falls back to KycEvent.findFirst for legacy rows started before
 * the KycInquiry table existed (pre-migration safety net).
 *
 * The `inquiryId` parameter carries the Sumsub applicantId (the KycInquiry
 * table key is kept vendor-agnostic).
 *
 * Idempotent: calling multiple times for the same applicantId is safe.
 */
export async function markKycComplete(inquiryId: string): Promise<void> {
  if (!inquiryId || inquiryId.trim() === "") {
    throw new Error("markKycComplete: inquiryId must be a non-empty string");
  }

  // --- Authoritative resolution via KycInquiry (P0-4) ---
  const claim = await prisma.kycInquiry.findUnique({ where: { inquiryId } });

  let userId: string | undefined;

  if (claim) {
    userId = claim.userId;
  } else {
    // Legacy fallback: resolve from KycEvent for inquiries that pre-date the
    // KycInquiry table. Log a warning so ops can track the tail.
    console.warn(
      `[markKycComplete] no KycInquiry claim, falling back to KycEvent (legacy) for inquiryId=${inquiryId}`,
    );
    const event = await prisma.kycEvent.findFirst({
      where: { inquiryId },
      orderBy: { receivedAt: "desc" },
    });
    userId = event?.userId;
  }

  if (!userId || userId === "unknown" || userId === "unclaimed") {
    console.warn(
      `[markKycComplete] inquiryId=${inquiryId} has no resolvable userId — skipping Investor update`,
    );
    return;
  }

  // P0-5: only pending→approved. A rejected investor is terminal and must
  // never be silently re-approved by a replayed/late webhook.
  await prisma.investor.updateMany({
    where: {
      user: { id: userId },
      kycStatus: "pending",
    },
    data: { kycStatus: "approved" },
  });
}
