"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { isDemoAccount } from "@/lib/demo/allowlist";

// =============================================================================
// resetDemoAccount — wipes the CALLER'S demo state back to square one.
// =============================================================================
//
// Unsubscribes from everything and resets onboarding progress for the demo
// account only. Every guard is server-side:
//   1. requireInvestor() proves an authenticated session.
//   2. isDemoAccount(session.email) — a real investor is refused (returns error;
//      the button is also never rendered for them, this is defence in depth).
//   3. All deletes are scoped to THIS investor's own id — never a global wipe,
//      so a real investor's positions (e.g. the on-chain account) are untouchable
//      from here even if the allowlist were somehow bypassed.
//
// Not a financial/custodial action: it only clears local demo bookkeeping rows.

export type ResetDemoResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resetDemoAccount(): Promise<ResetDemoResult> {
  const session = await requireInvestor("/profile");

  if (!isDemoAccount(session.email)) {
    // A real investor must never reach the destructive path.
    return { ok: false, error: "This action is only available on demo accounts." };
  }

  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }
  const investorId = investor.id;
  const userId = investor.userId;

  // Scoped, ordered deletes (children before parents). Everything is keyed to
  // THIS investor / user — never a global deleteMany.
  await prisma.$transaction([
    prisma.investorTransaction.deleteMany({ where: { investorId } }),
    prisma.position.deleteMany({ where: { investorId } }),
    prisma.investorNavSnapshot.deleteMany({ where: { investorId } }),
    prisma.kycEvent.deleteMany({ where: { userId } }),
    prisma.kycInquiry.deleteMany({ where: { userId } }),
    prisma.investor.update({
      where: { id: investorId },
      data: {
        kycStatus: "pending",
        accreditationAttestedAt: null,
        walletAddress: null,
      },
    }),
  ]);

  // Refresh every surface the reset touches.
  revalidatePath("/profile");
  revalidatePath("/portfolio");
  revalidatePath("/onboarding/accreditation");
  revalidatePath("/onboarding/identity");
  revalidatePath("/onboarding/wallet");

  return { ok: true };
}
