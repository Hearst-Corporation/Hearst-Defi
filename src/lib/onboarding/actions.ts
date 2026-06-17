"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
import { requireInvestor } from "@/lib/auth/require-investor";
import { markKycComplete } from "@/lib/onboarding/kyc-complete";
import {
  createApplicant,
  uploadIdDoc,
  requestApplicantCheck,
  ID_DOC_TYPES,
} from "@/lib/onboarding/sumsub";

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

// =============================================================================
// claimKycInquiry — P0-4 defence: server-authoritative inquiry→user binding
// =============================================================================

/**
 * claimKycInquiry
 *
 * Called by the onboarding UI (KycDocumentForm / submitKycDocument) BEFORE the
 * document is uploaded. It binds the Sumsub applicantId to the
 * AUTHENTICATED session user on the server, so the webhook can resolve the
 * userId from THIS table instead of the client-echoed externalUserId in the
 * Sumsub payload.
 *
 * NOTE: the `inquiryId` parameter and the KycInquiry table are kept verbatim
 * (vendor-agnostic) — under Sumsub the value stored is the applicantId.
 *
 * Security (P0-4): without this binding an attacker could launch a Sumsub
 * applicant echoing the victim's userId as the externalUserId and trigger
 * approval of the victim's account. The webhook now ONLY approves accounts
 * whose applicantId was first claimed through a valid server session.
 *
 * Idempotent for the same (inquiryId, userId) pair (safe to retry).
 * Throws if the inquiryId is already claimed by a DIFFERENT userId (anti-theft).
 */
export async function claimKycInquiry(
  inquiryId: string,
): Promise<{ ok: boolean }> {
  if (!inquiryId || inquiryId.trim() === "") {
    throw new Error("claimKycInquiry: inquiryId must be a non-empty string");
  }

  const session = await requireInvestor("/onboarding/identity");
  const userId = session.userId;

  const existing = await prisma.kycInquiry.findUnique({
    where: { inquiryId },
  });

  if (existing) {
    if (existing.userId === userId) {
      // Same user re-claims — idempotent, ok.
      return { ok: true };
    }
    // Different user already owns this inquiryId — potential spoofing attempt.
    throw new Error("Inquiry already claimed by another account");
  }

  // E1: concurrent calls for the same inquiryId could both pass the findUnique
  // above (null) and then race to create — catch P2002 and verify ownership.
  try {
    await prisma.kycInquiry.create({
      data: { inquiryId, userId },
    });
  } catch (err) {
    if (isP2002(err)) {
      const after = await prisma.kycInquiry.findUnique({ where: { inquiryId } });
      if (after && after.userId !== userId) {
        throw new Error("Inquiry already claimed by another account");
      }
      // else: we lost the race to our own concurrent claim — idempotent success.
    } else {
      throw err;
    }
  }

  // B1: the webhook may have arrived before this claim (Sumsub races ahead).
  // If a terminal KYC event already landed, replay the approval now that the
  // authoritative link exists — otherwise the investor would stay pending forever.
  const terminal = await prisma.kycEvent.findFirst({
    where: { inquiryId, status: { in: ["completed", "approved"] } },
    orderBy: { receivedAt: "desc" },
  });
  if (terminal) {
    await markKycComplete(inquiryId);
  }

  return { ok: true };
}

// markKycComplete moved to "@/lib/onboarding/kyc-complete" (D1 fix):
// it is an internal server-only function, NOT a Server Action, so it can never
// be invoked as an RPC by a logged-in client to force-approve KYC. It is
// imported above and used by claimKycInquiry() (B1 replay) + the Sumsub webhook.

// =============================================================================
// bindWallet — persist distribution wallet on Investor
// =============================================================================

const EvmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");

export type BindWalletResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Records the investor's distribution wallet in the database.
 * Source of truth for profile, portfolio next-action, and admin distributions.
 */
export async function bindWallet(
  walletAddress: string,
): Promise<BindWalletResult> {
  await requireInvestor("/onboarding/wallet");
  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }

  if (investor.walletAddress?.toLowerCase() === walletAddress.trim().toLowerCase()) {
    return { ok: true };
  }

  const parsed = EvmAddressSchema.safeParse(walletAddress.trim());
  if (!parsed.success) {
    return { ok: false, error: "Invalid wallet address." };
  }

  const normalized = parsed.data.toLowerCase();

  const taken = await prisma.investor.findFirst({
    where: {
      walletAddress: normalized,
      id: { not: investor.id },
    },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "This wallet is already linked to another account." };
  }

  await prisma.investor.update({
    where: { id: investor.id },
    data: { walletAddress: normalized },
  });

  revalidatePath("/onboarding/wallet");
  revalidatePath("/profile");
  revalidatePath("/portfolio");

  return { ok: true };
}

// =============================================================================
// submitKycDocument — CUSTOM Sumsub document upload (no WebSDK)
// =============================================================================

/** Max accepted document size — 10 MB. */
const MAX_KYC_FILE_BYTES = 10 * 1024 * 1024;

/** Accepted document MIME types (image or PDF). */
const ACCEPTED_KYC_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** Form fields parsed from the upload (the File is validated separately). */
const KycDocumentFieldsSchema = z.object({
  idDocType: z.enum(ID_DOC_TYPES),
  // ISO 3166-1 alpha-3, e.g. "GBR" / "FRA".
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Country must be an ISO 3-letter code"),
});

export type SubmitKycDocumentResult =
  | { ok: true; applicantId: string }
  | { ok: false; error: string };

/**
 * submitKycDocument
 *
 * Server action backing OUR Cockpit KYC form (no Sumsub WebSDK / iframe / CDN).
 * The investor uploads an identity document; we create a Sumsub applicant for
 * the authenticated session user, claim the applicantId server-side (P0-4),
 * upload the document, and ask Sumsub to start the review. The GREEN/RED verdict
 * lands later on the existing webhook — this action NEVER approves KYC itself;
 * the investor stays "pending" until the webhook flips them.
 *
 * Flow:
 *   1. requireInvestor() → session.userId (externalUserId is ALWAYS the server
 *      session id, never a client-supplied value).
 *   2. createApplicant(userId, "id-only") → applicantId (idempotent on 409).
 *   3. claimKycInquiry(applicantId) — binds applicantId→userId BEFORE anything
 *      else so the webhook can resolve the user authoritatively.
 *   4. uploadIdDoc(applicantId, …file bytes…).
 *   5. requestApplicantCheck(applicantId) — best-effort review trigger.
 */
export async function submitKycDocument(
  formData: FormData,
): Promise<SubmitKycDocumentResult> {
  const session = await requireInvestor("/onboarding/identity");
  const userId = session.userId;

  // 1. Validate the text fields.
  const parsed = KycDocumentFieldsSchema.safeParse({
    idDocType: formData.get("idDocType"),
    country: formData.get("country"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid document details.",
    };
  }

  // 2. Validate the uploaded file.
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "A document file is required." };
  }
  if (file.size > MAX_KYC_FILE_BYTES) {
    return { ok: false, error: "File is too large (max 10 MB)." };
  }
  if (!(ACCEPTED_KYC_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Unsupported file type. Use an image or PDF." };
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  try {
    // 3. Create (or recover) the applicant for OUR session user.
    const { applicantId } = await createApplicant(userId, "id-only");

    // 4. P0-4 — bind applicantId→userId on the server BEFORE the upload, so the
    //    webhook resolves the user from KycInquiry, never from the payload.
    await claimKycInquiry(applicantId);

    // 5. Upload the document, then ask Sumsub to start the review (best-effort).
    await uploadIdDoc(applicantId, {
      idDocType: parsed.data.idDocType,
      country: parsed.data.country,
      fileBytes,
      fileName: file.name || "document",
      mimeType: file.type,
    });
    await requestApplicantCheck(applicantId);

    revalidatePath("/onboarding/identity");

    // The investor stays pending — only the webhook approves on GREEN.
    return { ok: true, applicantId };
  } catch (err) {
    console.error("[submitKycDocument] failed:", err);
    return {
      ok: false,
      error: "Could not submit your document. Please try again.",
    };
  }
}
