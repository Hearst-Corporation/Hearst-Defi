"use server";

import { revalidatePath } from "next/cache";
export type EligibilityResult =
  | { ok: true }
  | { ok: false; error: string };

import { prisma } from "@/lib/db";
import { getInvestor, getSession } from "@/lib/auth/session";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { getVault } from "@/lib/data/vaults";
import {
  CapacityError,
  isUniqueViolation,
  MAX_SUBSCRIBE_USDC,
  type ShareClassCode,
  validateMinTicket,
  createPositionInTransaction,
} from "@/lib/positions/subscribe-logic";

/**
 * Subscribe to a vault — creates a real DB position for the current investor.
 *
 * Flow (in-cockpit subscription on /portfolio):
 *   investor → Position (principal) + InvestorTransaction (deposit) → revalidate.
 *
 * Guards:
 *  - Requires a resolved investor (Privy in prod, dev investor locally).
 *  - Validates the amount against the effective minimum ticket and capacity.
 *  - Validates the classCode against the share class terms (A: 60d lock-up,
 *    B: 90d). Minimums are the class presets (A: $250k, B: $1M) unless the
 *    `MIN_TICKET_USDC` env override lowers them — see
 *    src/lib/vaults/min-ticket.ts.
 *  - Links `vaultDeploymentId` only when the id matches a real DB deployment;
 *    otherwise falls back to the `vaultKey` column (single-vault MVP fixture).
 *
 * No forbidden words, no returns promised — this only records the deposit.
 */

/**
 * Pre-flight KYC + accreditation gate — runs BEFORE the on-chain tx so the
 * investor can't fire a deposit that would be rejected by subscribe().
 * Call this in the UI at Confirm time, before depositToVault().
 */
export async function checkSubscribeEligibility(
  vaultId: string,
): Promise<EligibilityResult> {
  const investor = await getInvestor();
  if (!investor) return { ok: false, error: "Authentication required." };
  if (!investor.accreditationAttestedAt) {
    return { ok: false, error: "Accreditation attestation required before subscribing." };
  }
  if (investor.kycStatus !== "approved") {
    return { ok: false, error: "KYC approval required before subscribing." };
  }
  const vault = await getVault(vaultId);
  if (!vault) return { ok: false, error: "Vault not found." };
  if (vault.status !== "live") {
    return { ok: false, error: "This vault is not open for subscription." };
  }
  return { ok: true };
}

export type SubscribeResult =
  | { ok: true; positionId: string }
  | { ok: false; error: string };

export async function subscribe(
  vaultId: string,
  amountUsdc: number,
  classCode: ShareClassCode = "A",
  txHash?: string,
  opts?: { allowOffChain?: boolean },
): Promise<SubscribeResult> {
  const investor = await getInvestor();
  if (!investor) {
    throw new Error("Unauthenticated");
  }

  if (!investor.accreditationAttestedAt) {
    return { ok: false, error: "Accreditation attestation required before subscribing." };
  }

  // C-01: KYC gate — only approved investors may subscribe.
  if (investor.kycStatus !== "approved") {
    return { ok: false, error: "KYC approval required before subscribing." };
  }

  if (amountUsdc > MAX_SUBSCRIBE_USDC) {
    return { ok: false, error: "Amount too large." };
  }

  const vault = await getVault(vaultId);
  if (!vault) {
    return { ok: false, error: "Vault not found." };
  }
  if (vault.status !== "live") {
    return { ok: false, error: "This vault is not open for subscription." };
  }

  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }

  // Validate against the selected share class minimum ticket.
  //
  // CRITICAL: by the time this runs, the investor's on-chain USDC deposit has
  // ALREADY settled and is irreversible. This floor must therefore be the exact
  // number the invest form displayed and gated on (`vault.minTicketUsdc`) — a
  // stricter one here means the money is gone and no Position is created. Both
  // sides resolve through src/lib/vaults/min-ticket.ts precisely so they cannot
  // drift; do NOT add an environment condition around this call.
  const minTicketCheck = validateMinTicket(amountUsdc, classCode);
  if (!minTicketCheck.ok) {
    return minTicketCheck;
  }

  // Ledger integrity: a subscription must be backed by a confirmed on-chain
  // deposit. The public investor flow (invest-form) always passes the deposit
  // tx hash; only the explicit, audited pilot path may create an off-chain
  // position with no settlement (`allowOffChain`). A malformed hash is rejected
  // so a typo can neither poison the ledger nor the txHashOpen idempotency key.
  //
  // SECURITY: `subscribe` is a server action reachable as an RPC, so `opts` is
  // client-controlled. `allowOffChain` (settlement-free position, the audited
  // pilot + demo shortcut) is therefore honored ONLY for a TRUSTED operator —
  // an admin session or a demo account (both server-resolved). A plain investor
  // POSTing `{allowOffChain:true}` is silently downgraded to false and still
  // needs a confirmed on-chain deposit, so the public invest-form can never
  // fabricate a position without settlement.
  const session = await getSession();
  const isTrustedOffChainCaller =
    session?.role === "admin" || isDemoAccount(session?.email);
  const requestedOffChain = opts?.allowOffChain ?? false;
  const allowOffChain = requestedOffChain && isTrustedOffChainCaller;
  const txHashClean =
    txHash && txHash.trim().length > 0 ? txHash.trim() : undefined;
  if (txHashClean && !/^0x[0-9a-fA-F]{64}$/.test(txHashClean)) {
    return { ok: false, error: "Invalid deposit transaction hash." };
  }
  if (!allowOffChain && !txHashClean) {
    return {
      ok: false,
      error: "A confirmed on-chain deposit is required to subscribe.",
    };
  }

  // P0-1: idempotency — if this on-chain deposit was already recorded, return
  // the existing position instead of creating a duplicate (retry/double-submit).
  if (txHashClean) {
    const existing = await prisma.position.findUnique({
      where: { txHashOpen: txHashClean },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, positionId: existing.id };
    }
  }

  // Link to a real VaultDeployment row only if the id resolves to one;
  // the inline fixture id ("hearst-yield-vault") has no DB row → vaultKey fallback.
  const deployment = await prisma.vaultDeployment.findUnique({
    where: { id: vaultId },
    select: { id: true },
  });

  // P0-2: capacity check + write happen in one transaction. Consumed capacity is
  // re-derived from the live sum of active principal (not the cached snapshot)
  // and re-checked inside the transaction, so concurrent subscriptions cannot
  // both pass a stale `remaining` and over-subscribe the vault cap.
  try {
    const position = await prisma.$transaction(async (tx) => {
      return createPositionInTransaction(tx, {
        investorId: investor.id,
        vaultId,
        amountUsdc,
        classCode,
        capacityUsdc: vault.capacityUsdc,
        deploymentId: deployment?.id ?? null,
        txHash: txHashClean,
      });
    });

    // Create Subscription row — links the position to a ShareClass for
    // distribution targeting and admin ledger completeness. Non-fatal:
    // fixture vaults (no VaultDeployment row) have no ShareClass rows,
    // and a missing Subscription must never block a confirmed deposit.
    if (deployment) {
      try {
        const shareClassRow = await prisma.shareClass.findUnique({
          where: { vaultId_code: { vaultId: deployment.id, code: classCode } },
        });
        if (shareClassRow) {
          const lockupUntil = new Date(
            Date.now() + shareClassRow.lockupDays * 86_400_000,
          );
          await prisma.subscription.create({
            data: {
              userId: investor.userId,
              vaultId: deployment.id,
              shareClassId: shareClassRow.id,
              amount: amountUsdc,
              lockupUntil,
              status: "confirmed",
            },
          });
        }
      } catch {
        // Non-fatal — Position is the source of truth
      }
    }

    revalidatePath("/portfolio");
    revalidatePath("/admin/customers");
    if (deployment) revalidatePath(`/admin/vaults/${deployment.id}`);
    return { ok: true, positionId: position.id };
  } catch (err) {
    if (err instanceof CapacityError) {
      return { ok: false, error: "Amount exceeds remaining capacity." };
    }
    // P0-1: lost the race against a concurrent retry of the same deposit —
    // the unique txHashOpen constraint fired. Resolve to the existing position.
    if (isUniqueViolation(err) && txHashClean) {
      const existing = await prisma.position.findUnique({
        where: { txHashOpen: txHashClean },
        select: { id: true },
      });
      if (existing) {
        return { ok: true, positionId: existing.id };
      }
    }
    throw err;
  }
}
