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
  // DEMO override: DEMO_MIN_TICKET_USDC lowers the floor for testnet demos so a
  // small real on-chain deposit (e.g. a few faucet USDC) can open a position.
  // Never set in production — the canonical class terms ($250k/$1M) stay intact.
  const classTerms = resolveClassTerms(classCode);
  const demoMinRaw = process.env.DEMO_MIN_TICKET_USDC;
  // development only — never prod (canonical minimums) and never test (keeps the
  // suite asserting the real $250k/$1M gates, not the demo floor).
  const demoMin =
    process.env.NODE_ENV === "development" && demoMinRaw
      ? Number(demoMinRaw)
      : null;
  const effectiveMin =
    demoMin !== null && Number.isFinite(demoMin) && demoMin > 0
      ? demoMin
      : classTerms.minTicketUsdc;
  if (amountUsdc < effectiveMin) {
    // Format: show raw dollar amount when < $1,000 (avoids "$0k" for small demo mins),
    // otherwise use the canonical "Nk" or "NM" format for institutional ticket sizes.
    const minLabel =
      effectiveMin < 1_000
        ? `$${effectiveMin.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
        : effectiveMin < 1_000_000
          ? `$${(effectiveMin / 1_000).toFixed(0)}k`
          : `$${(effectiveMin / 1_000_000).toFixed(0)}M`;
    return {
      ok: false,
      error: `Below minimum ticket of ${minLabel} for Class ${classCode}.`,
    };
  }

  // Ledger integrity: a subscription must be backed by a confirmed on-chain
  // deposit. The public investor flow (invest-form) always passes the deposit
  // tx hash; only the explicit, audited pilot path may create an off-chain
  // position with no settlement (`allowOffChain`). A malformed hash is rejected
  // so a typo can neither poison the ledger nor the txHashOpen idempotency key.
  const allowOffChain = opts?.allowOffChain ?? false;
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
          // On-chain deposit tx hash (Base Sepolia). Null only for the audited
          // off-chain pilot path (`allowOffChain`); the public flow requires it.
          txHashOpen: txHashClean ?? null,
          transactions: {
            create: {
              investorId: investor.id,
              type: "deposit",
              amountUsdc,
              txHash: txHashClean ?? null,
            },
          },
        },
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
