import { Prisma } from "@prisma/client";
import { SHARE_CLASS_A, SHARE_CLASS_B, type ShareClassTerms } from "@/lib/engine/share-class";
import { formatMinTicketUsdc } from "@/lib/vaults/product-display";
import { resolveMinTicketUsdc } from "@/lib/vaults/min-ticket";

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
 * Validates the subscription amount against the effective minimum ticket.
 *
 * The floor is `resolveMinTicketUsdc(classTerms.minTicketUsdc)` — the share
 * class preset (A: 250k, B: 1M), lowered by `MIN_TICKET_USDC` when that env var
 * is configured. Resolution goes through src/lib/vaults/min-ticket.ts, the SAME
 * module the data layer uses to build `vault.minTicketUsdc`, so the number this
 * function enforces is the number the invest form displayed and gated on.
 *
 * That identity is the whole point, and it is load-bearing: this check runs
 * AFTER the investor's on-chain USDC deposit has settled. A floor here that is
 * higher than the one the form advertised means the deposit is irreversibly
 * gone while the Position is never created. See
 * src/lib/vaults/__tests__/min-ticket.test.ts.
 *
 * The override is honored in EVERY environment. The previous signature took an
 * `isDevelopment` flag feeding an `isDevelopment || NODE_ENV !== "production"`
 * gate that made the override inert in production; it is gone on purpose. Do
 * not re-introduce an environment condition here — a floor that depends on
 * NODE_ENV is a floor the form cannot predict.
 */
export function validateMinTicket(
  amountUsdc: number,
  classCode: ShareClassCode,
): { ok: true } | { ok: false; error: string } {
  const classTerms = resolveClassTerms(classCode);
  const effectiveMin = resolveMinTicketUsdc(classTerms.minTicketUsdc);

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
