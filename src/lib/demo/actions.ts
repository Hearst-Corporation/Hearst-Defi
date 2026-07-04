"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { prisma } from "@/lib/db";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { subscribe } from "@/app/actions/subscribe";
import { shareClassCode } from "@/lib/vaults/product-display";

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

  // Scoped, ordered deletes (children before parents). Everything is keyed to
  // THIS investor / user — never a global deleteMany.
  //
  // "Unsubscribe from everything": positions, ledger, and NAV history are wiped
  // so the portfolio is empty again. Onboarding status is DELIBERATELY kept —
  // kycStatus stays `approved`, accreditation and wallet stay set — so the demo
  // account never falls back into the KYC gate after a reset. (Use the terminal
  // kyc-demo lever if you want to re-run the KYC verification flow from scratch.)
  await prisma.$transaction([
    prisma.investorTransaction.deleteMany({ where: { investorId } }),
    prisma.position.deleteMany({ where: { investorId } }),
    prisma.investorNavSnapshot.deleteMany({ where: { investorId } }),
  ]);

  // Also clear the demo-seeded vault-level snapshot (the "Capital & Yield"
  // allocation donut). It is NOT investor-scoped, so it survives the deletes
  // above; a demo reset should still take the portfolio fully back to empty.
  // Only rows we ourselves stamped source="demo_seed" are removed — real
  // live/computed snapshots are never touched. Allocation rows cascade.
  await prisma.vaultSnapshot.deleteMany({ where: { source: "demo_seed" } });
  // Evict the unstable_cache(tags:["yield"]) entry so the donut reflects the
  // now-empty state immediately instead of the stale cached snapshot.
  revalidateTag("yield", "max");

  // Refresh every surface the reset touches.
  revalidatePath("/profile");
  revalidatePath("/portfolio");

  return { ok: true };
}

// =============================================================================
// simulateKycApproval — demo shortcut that "passes" KYC without Sumsub.
// =============================================================================
//
// Flips the demo account's kycStatus to `approved` (and attests accreditation)
// so the reviewer can watch the verified state without a real vendor round-trip.
// Allowlist-gated + scoped to the caller's own investor. Never touches a real
// investor; the real KYC path (Sumsub webhook → markKycComplete) is unchanged.

export type SimulateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function simulateKycApproval(): Promise<SimulateResult> {
  const session = await requireInvestor("/onboarding/identity");
  if (!isDemoAccount(session.email)) {
    return { ok: false, error: "This action is only available on demo accounts." };
  }

  const investor = await getInvestor();
  if (!investor) return { ok: false, error: "Authentication required." };

  await prisma.investor.update({
    where: { id: investor.id },
    data: { kycStatus: "approved", accreditationAttestedAt: new Date() },
  });

  revalidatePath("/onboarding/identity");
  revalidatePath("/profile");
  revalidatePath("/portfolio");
  return { ok: true };
}

// =============================================================================
// simulateDeposit — demo shortcut that subscribes WITHOUT an on-chain tx.
// =============================================================================
//
// The real invest flow requires a connected wallet + a confirmed Base Sepolia
// deposit tx. For the demo account we create the Position off-chain via the
// audited `allowOffChain` path in subscribe(), so the reviewer sees a funded
// portfolio without any testnet wallet or USDC. Allowlist-gated; subscribe()
// still enforces KYC/accreditation/capacity/min-ticket, so nothing is bypassed
// except the on-chain settlement requirement.

export type SimulateDepositResult =
  | { ok: true; positionId: string }
  | { ok: false; error: string };

export async function simulateDeposit(
  vaultId: string,
  amountUsdc: number,
  shareClass: string = "A",
): Promise<SimulateDepositResult> {
  const session = await requireInvestor(`/vaults/${vaultId}/invest`);
  if (!isDemoAccount(session.email)) {
    return { ok: false, error: "This action is only available on demo accounts." };
  }

  const result = await subscribe(
    vaultId,
    amountUsdc,
    shareClassCode(shareClass),
    undefined,
    { allowOffChain: true },
  );
  if (!result.ok) return result;

  revalidatePath("/portfolio");
  return { ok: true, positionId: result.positionId };
}
