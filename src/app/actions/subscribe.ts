"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
import { getVault } from "@/lib/data/vaults";
import { SHARE_CLASS_A, SHARE_CLASS_B, type ShareClassTerms } from "@/lib/engine/share-class";

/** Sentinel thrown inside the subscribe transaction when capacity is exceeded. */
class CapacityError extends Error {}

/** True when err is a Prisma P2002 unique violation (txHash/txHashOpen collision). */
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * Subscribe to a vault — creates a real DB position for the current investor.
 *
 * Flow (in-cockpit subscription on /portfolio):
 *   investor → Position (principal) + InvestorTransaction (deposit) → revalidate.
 *
 * Guards:
 *  - Requires a resolved investor (Privy in prod, dev investor locally).
 *  - Validates the amount against the vault's minimum ticket and capacity.
 *  - Validates the classCode against the share class terms (A: $250k/60d, B: $1M/90d).
 *  - Links `vaultDeploymentId` only when the id matches a real DB deployment;
 *    otherwise falls back to the `vaultKey` column (single-vault MVP fixture).
 *
 * No forbidden words, no returns promised — this only records the deposit.
 */

/** Hard ceiling on a single subscription amount (1 billion USDC). */
const MAX_SUBSCRIBE_USDC = 1_000_000_000;

/** Supported share class codes. */
export type ShareClassCode = "A" | "B";

export type SubscribeResult =
  | { ok: true; positionId: string }
  | { ok: false; error: string };

/** Resolve the canonical terms for a given share class code. */
function resolveClassTerms(classCode: ShareClassCode): ShareClassTerms {
  return classCode === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
}

export async function subscribe(
  vaultId: string,
  amountUsdc: number,
  classCode: ShareClassCode = "A",
  txHash?: string,
): Promise<SubscribeResult> {
  const investor = await getInvestor();
  if (!investor) {
    throw new Error("Unauthenticated");
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
  const classTerms = resolveClassTerms(classCode);
  if (amountUsdc < classTerms.minTicketUsdc) {
    return {
      ok: false,
      error: `Below minimum ticket of $${(classTerms.minTicketUsdc / 1_000).toFixed(0)}k for Class ${classCode}.`,
    };
  }

  // P0-1: idempotency — if this on-chain deposit was already recorded, return
  // the existing position instead of creating a duplicate (retry/double-submit).
  if (txHash) {
    const existing = await prisma.position.findUnique({
      where: { txHashOpen: txHash },
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
      const agg = await tx.position.aggregate({
        where: {
          status: "active",
          ...(deployment
            ? { vaultDeploymentId: deployment.id }
            : { vaultKey: { startsWith: `${vaultId}:` } }),
        },
        _sum: { principalUsdc: true },
      });
      const consumed = agg._sum.principalUsdc?.toNumber() ?? 0;
      const remaining = vault.capacityUsdc - consumed;
      if (amountUsdc > remaining) {
        throw new CapacityError();
      }

      // Atomic: position + deposit transaction via Prisma nested write.
      return tx.position.create({
        data: {
          investorId: investor.id,
          vaultDeploymentId: deployment?.id ?? null,
          // Store the share class code in the vaultKey field as a suffix so that
          // downstream loaders can distinguish A vs B positions without a schema
          // migration (additive, non-breaking to E1 Class A positions).
          vaultKey: `${vaultId}:class-${classCode}`,
          principalUsdc: amountUsdc,
          status: "active",
          // On-chain deposit tx hash (Base Sepolia). Null for in-cockpit/manual
          // subscriptions that did not originate from a signed vault deposit.
          txHashOpen: txHash ?? null,
          transactions: {
            create: {
              investorId: investor.id,
              type: "deposit",
              amountUsdc,
              txHash: txHash ?? null,
            },
          },
        },
      });
    });

    revalidatePath("/portfolio");
    return { ok: true, positionId: position.id };
  } catch (err) {
    if (err instanceof CapacityError) {
      return { ok: false, error: "Amount exceeds remaining capacity." };
    }
    // P0-1: lost the race against a concurrent retry of the same deposit —
    // the unique txHashOpen constraint fired. Resolve to the existing position.
    if (isUniqueViolation(err) && txHash) {
      const existing = await prisma.position.findUnique({
        where: { txHashOpen: txHash },
        select: { id: true },
      });
      if (existing) {
        return { ok: true, positionId: existing.id };
      }
    }
    throw err;
  }
}
