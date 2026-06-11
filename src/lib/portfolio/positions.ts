/**
 * getPositions — server query for P&L per position in /portfolio.
 *
 * NOTE: The Prisma schema (2026-05-26) uses `Position` (with principalUsdc,
 * accruedYieldUsdc, distributedUsdc) and `InvestorTransaction` for individual
 * distribution events. There is no dedicated `Subscription` model yet.
 *
 * Mapping:
 *   costBasis    = Position.principalUsdc      (sum of active subscriptions)
 *   currentNav   = principalUsdc × navMultiplier derived from VaultDeployment
 *   unrealizedPnl = currentNav - costBasis
 *   realizedPnl  = sum of InvestorTransaction(type=distribution) for this position
 *   totalReturn  = unrealizedPnl + realizedPnl
 *   irrAnnualized = XIRR(cashFlows)
 *   lockReleaseDate = subscribedAt + softLockupDays when deployment terms exist
 *
 * TODO(wire): When a `Subscription` model is added (E1/E2), replace the
 * Position.principalUsdc fallback with `sum(Subscription.amount WHERE status='active')`.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { irrAnnualized } from "@/lib/portfolio/irr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PositionPnl {
  /** Unique position id. */
  id: string;
  /** Vault display name from VaultDeployment. Null when deployment is missing. */
  vaultName: string | null;
  /** Vault ticker (e.g. "HYV-A"). Null when deployment is missing. */
  vaultTicker: string | null;
  /** Share class identifier (e.g. "A"). Null when deployment is missing. */
  shareClass: string | null;
  /** Cost basis = principal invested, USDC. */
  costBasisUsdc: number;
  /** Current NAV = costBasis × navMultiplier, USDC. Provenance: "Live". */
  currentNavUsdc: number;
  /** unrealizedPnl = currentNav - costBasis (can be negative). */
  unrealizedPnlUsdc: number;
  /** Sum of distributions received, USDC. Provenance: computed from DB. */
  realizedPnlUsdc: number;
  /** unrealized + realized. */
  totalReturnUsdc: number;
  /**
   * Annualised IRR (decimal, e.g. 0.112 = 11.2%). Provenance: "Estimated".
   * Null when < 1 day held or no inflow data yet.
   */
  irrAnnualized: number | null;
  /** Date when the soft lock-up expires. Null when deployment terms are missing. */
  lockReleaseDate: Date | null;
  /** Position status. */
  status: "active" | "matured" | "exited";
  /** Date of the original subscription. */
  subscribedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Returns P&L rows for every active/matured/exited position of a given user.
 * Sorted by `totalReturnUsdc` descending (best performers first).
 *
 * @param userId  The `User.id` (authentication identity) for the investor.
 * @param asOf    "Now" — injected so callers (tests) can control the clock.
 */
export async function getPositions(
  userId: string,
  asOf: Date = new Date(),
): Promise<PositionPnl[]> {
  // Resolve Investor from User.id.
  const investor = await prisma.investor.findUnique({
    where: { userId },
  });

  if (!investor) return [];

  // Fetch all positions with their vault deployments.
  const rawPositions = await prisma.position.findMany({
    where: { investorId: investor.id },
    include: { vaultDeployment: true },
    orderBy: { subscribedAt: "desc" },
    take: 200,
  });

  if (rawPositions.length === 0) return [];

  // Fetch all distribution transactions for these positions in one query.
  const positionIds = rawPositions.map((p) => p.id);
  const rawDistribs = await prisma.investorTransaction.findMany({
    where: {
      positionId: { in: positionIds },
      type: "distribution",
    },
    select: {
      positionId: true,
      amountUsdc: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  // Group distributions by positionId.
  const distribsByPosition = new Map<
    string,
    Array<{ amountUsdc: number; date: Date }>
  >();
  for (const tx of rawDistribs) {
    if (!tx.positionId) continue;
    const arr = distribsByPosition.get(tx.positionId) ?? [];
    arr.push({ amountUsdc: toNumber(tx.amountUsdc), date: tx.occurredAt });
    distribsByPosition.set(tx.positionId, arr);
  }

  const rows: PositionPnl[] = rawPositions.map((pos) => {
    const costBasis = toNumber(pos.principalUsdc);
    const accruedYield = toNumber(pos.accruedYieldUsdc);

    // Current NAV: principal + accrued yield (the canonical product definition).
    const currentNav = costBasis + accruedYield;

    const unrealizedPnl = currentNav - costBasis; // = accruedYield

    const distributions = distribsByPosition.get(pos.id) ?? [];
    const realizedPnl = distributions.reduce((s, d) => s + d.amountUsdc, 0);

    const totalReturn = unrealizedPnl + realizedPnl;

    const shareClass = pos.vaultDeployment?.shareClass ?? null;
    const vaultName = pos.vaultDeployment?.name ?? null;
    const vaultTicker = pos.vaultDeployment?.ticker ?? null;

    const softLockupDays = pos.vaultDeployment?.softLockupDays ?? null;
    const lockReleaseDate =
      softLockupDays === null ? null : addDays(pos.subscribedAt, softLockupDays);

    // XIRR — inject `asOf` to keep IRR fn pure.
    const irr = irrAnnualized({
      costBasisUsdc: costBasis,
      subscribedAt: pos.subscribedAt,
      distributionsUsdc: distributions,
      currentNavUsdc: currentNav,
      asOf,
    });

    return {
      id: pos.id,
      vaultName,
      vaultTicker,
      shareClass,
      costBasisUsdc: Math.round(costBasis * 100) / 100,
      currentNavUsdc: Math.round(currentNav * 100) / 100,
      unrealizedPnlUsdc: Math.round(unrealizedPnl * 100) / 100,
      realizedPnlUsdc: Math.round(realizedPnl * 100) / 100,
      totalReturnUsdc: Math.round(totalReturn * 100) / 100,
      irrAnnualized: irr,
      lockReleaseDate,
      status: pos.status as "active" | "matured" | "exited",
      subscribedAt: pos.subscribedAt,
    };
  });

  // Sort by totalReturn descending (non-negotiable E3 requirement).
  return rows.sort((a, b) => b.totalReturnUsdc - a.totalReturnUsdc);
}
