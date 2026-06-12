"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";

/**
 * Redeem (withdraw) from a vault position — records the off-chain side of an
 * ERC-4626 `redeem`. The on-chain burn+transfer is executed client-side via
 * `redeemFromVault` (src/lib/onchain/vault.ts); this action persists the result:
 *
 *   investor → InvestorTransaction(type="withdraw") → Position reduced/exited → revalidate.
 *
 * Guards:
 *  - Requires the resolved investor and ownership of the position.
 *  - Position must be `active`.
 *  - Amount must be positive and not exceed the remaining principal.
 *  - Full redemption (amount ≥ principal) marks the position `exited` with
 *    `exitedAt`; a partial redemption reduces `principalUsdc` and stays active.
 *
 * No returns promised — this only records the withdrawal.
 */

export type RedeemResult =
  | { ok: true; positionId: string; closed: boolean }
  | { ok: false; error: string };

export async function redeem(
  positionId: string,
  amountUsdc: number,
  txHash?: string,
): Promise<RedeemResult> {
  const investor = await getInvestor();
  if (!investor) {
    throw new Error("Unauthenticated");
  }

  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }

  // Pre-flight: load the position to verify ownership and status before entering
  // the transaction. This is a fast-path check only; the definitive guard is the
  // conditional update inside the transaction (see TOCTOU fix below).
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, investorId: true, status: true, principalUsdc: true },
  });

  if (!position || position.investorId !== investor.id) {
    return { ok: false, error: "Position not found." };
  }
  if (position.status !== "active") {
    return { ok: false, error: "Position is not active." };
  }

  const principalSnapshot = position.principalUsdc.toNumber();
  if (amountUsdc > principalSnapshot + 0.5) {
    return { ok: false, error: "Amount exceeds your position principal." };
  }

  // TOCTOU fix: instead of relying on the principal read above, perform a
  // conditional update inside the $transaction that re-validates the fresh
  // principal at write time. Two concurrent partial redeems will race on the
  // `principalUsdc: { gte: amount }` guard; the loser gets count=0 and we
  // abort, preventing over-withdraw.
  let closed = false;

  await prisma.$transaction(async (tx) => {
    // Re-read the position inside the transaction for a fresh principal.
    const fresh = await tx.position.findUnique({
      where: { id: positionId },
      select: { principalUsdc: true, status: true },
    });

    if (!fresh || fresh.status !== "active") {
      throw new Error("Position is not active.");
    }

    const freshPrincipal = fresh.principalUsdc.toNumber();
    if (amountUsdc > freshPrincipal + 0.5) {
      throw new Error("Amount exceeds your position principal.");
    }

    closed = amountUsdc >= freshPrincipal - 0.5;

    // Conditional update — guard: principal must still cover the requested amount.
    // For a partial redemption we use a relative decrement; for a full exit we
    // set principal to 0 and mark the position exited.
    const updateResult = await tx.position.updateMany({
      where: {
        id: position.id,
        status: "active",
        principalUsdc: { gte: new Prisma.Decimal(amountUsdc - 0.5) },
      },
      data: closed
        ? { status: "exited", exitedAt: new Date(), principalUsdc: new Prisma.Decimal(0) }
        : { principalUsdc: { decrement: new Prisma.Decimal(amountUsdc) } },
    });

    if (updateResult.count === 0) {
      // Another concurrent redeem already consumed the principal.
      throw new Error("Concurrent redeem conflict — please retry.");
    }

    await tx.investorTransaction.create({
      data: {
        investorId: investor.id,
        positionId: position.id,
        type: "withdraw",
        amountUsdc: new Prisma.Decimal(amountUsdc),
        txHash: txHash ?? null,
      },
    });
  });

  revalidatePath("/portfolio");
  return { ok: true, positionId: position.id, closed };
}
