import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SHARE_CLASS_A, SHARE_CLASS_B, type ShareClassTerms } from "@/lib/engine/share-class";
import { formatMinTicketUsdc } from "@/lib/vaults/product-display";

/** Sentinel thrown inside the subscribe transaction when capacity is exceeded. */
export class CapacityError extends Error {}

/** True when err is a Prisma P2002 unique violation (txHash/txHashOpen collision). */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** Hard ceiling on a single subscription amount (1 billion USDC). */
export const MAX_SUBSCRIBE_USDC = 1_000_000_000;

/** Supported share class codes. */
export type ShareClassCode = "A" | "B";

/** Resolve the canonical terms for a given share class code. */
export function resolveClassTerms(classCode: ShareClassCode): ShareClassTerms {
  return classCode === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
}

/**
 * Validates the subscription amount against the share class minimum ticket.
 * Handles the DEMO_MIN_TICKET_USDC override for testnet pilots.
 */
export function validateMinTicket(
  amountUsdc: number,
  classCode: ShareClassCode,
  isDevelopment: boolean,
): { ok: true } | { ok: false; error: string } {
  const classTerms = resolveClassTerms(classCode);
  const demoMinRaw = process.env.DEMO_MIN_TICKET_USDC;
  const demoMin = demoMinRaw ? Number(demoMinRaw) : null;

  // Demo override logic:
  // - subscribe() uses it in ANY env if present (testnet pilot).
  // - deployPosition() uses it only in development.
  // We'll follow the more restrictive one or pass a flag.
  const useDemo = isDevelopment || process.env.NODE_ENV !== "production";

  const effectiveMin =
    useDemo && demoMin !== null && Number.isFinite(demoMin) && demoMin > 0
      ? demoMin
      : classTerms.minTicketUsdc;

  if (amountUsdc < effectiveMin) {
    return {
      ok: false,
      error: `Below minimum ticket of ${formatMinTicketUsdc(effectiveMin)} for Class ${classCode}.`,
    };
  }
  return { ok: true };
}

/**
 * Shared atomic logic for creating a position and its deposit transaction.
 * Used by both the investor subscribe() action and the admin deployPosition() action.
 * Re-checks capacity inside the transaction to prevent over-subscription.
 */
export async function createPositionInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    investorId: string;
    vaultId: string;
    amountUsdc: number;
    classCode: ShareClassCode;
    capacityUsdc: number;
    deploymentId: string | null;
    txHash?: string | null;
  },
) {
  const {
    investorId,
    vaultId,
    amountUsdc,
    classCode,
    capacityUsdc,
    deploymentId,
    txHash,
  } = params;

  const agg = await tx.position.aggregate({
    where: {
      status: "active",
      ...(deploymentId
        ? { vaultDeploymentId: deploymentId }
        : { vaultKey: { startsWith: `${vaultId}:` } }),
    },
    _sum: { principalUsdc: true },
  });

  const consumed = agg._sum.principalUsdc?.toNumber() ?? 0;
  const remaining = capacityUsdc - consumed;

  if (amountUsdc > remaining) {
    throw new CapacityError("CAPACITY_EXCEEDED");
  }

  return tx.position.create({
    data: {
      investorId,
      vaultDeploymentId: deploymentId,
      vaultKey: `${vaultId}:class-${classCode}`,
      principalUsdc: amountUsdc,
      status: "active",
      txHashOpen: txHash ?? null,
      transactions: {
        create: {
          investorId,
          type: "deposit",
          amountUsdc,
          txHash: txHash ?? null,
        },
      },
    },
  });
}
