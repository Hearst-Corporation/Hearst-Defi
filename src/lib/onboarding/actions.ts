"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
import { requireInvestor } from "@/lib/auth/require-investor";

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
 * Called by the onboarding UI (persona-embed) BEFORE the Persona SDK starts
 * an inquiry. It binds the inquiry ID to the AUTHENTICATED session user on the
 * server, so the webhook can resolve the userId from THIS table instead of the
 * client-supplied reference-id in the Persona payload.
 *
 * Security (P0-4): without this binding an attacker could launch a Persona
 * inquiry with the victim's userId as the reference-id and trigger approval
 * of the victim's account. The webhook now ONLY approves accounts whose
 * inquiryId was first claimed through a valid server session.
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

  // B1: the webhook may have arrived before this claim (Persona races ahead).
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

// =============================================================================
// markKycComplete — C1 Persona KYC
// =============================================================================

/**
 * markKycComplete
 *
 * Server Action called by the Persona webhook when an inquiry reaches a
 * terminal "completed" or "approved" status.
 *
 * Resolves the userId AUTHORITATIVELY from KycInquiry (created by
 * claimKycInquiry() before the webhook arrives — P0-4 defence).
 * Falls back to KycEvent.findFirst for legacy inquiries started before
 * the KycInquiry table existed (pre-migration safety net).
 *
 * Idempotent: calling multiple times for the same inquiryId is safe.
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
