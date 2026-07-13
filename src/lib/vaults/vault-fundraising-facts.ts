import "server-only";

import { prisma } from "@/lib/db";

/**
 * Bitcoin Strategic Reserve B2B2C (P3) — fundraising view model for a single
 * `VaultDeployment`. Mirrors the "deriver" pattern of `vault-detail-facts.ts`:
 * a thin server-only module that reads Prisma and returns a plain, honest view
 * model — no stored aggregate columns, no fabricated numbers.
 *
 * `capitalRaisedUsdc` and `investorCount` are ALWAYS derived at read time from
 * `Position` rows (`status: "active"`, scoped to this vault) — see the schema
 * comment on `VaultDeployment.fundraisingStage` for why "Minimum Raised" /
 * "Target Reached" are predicates, not stored booleans. Do NOT add a stored
 * `capitalRaisedUsdc` column — this file is the single source for that number.
 *
 * Every percentage/derived field guards against missing targets and
 * divide-by-zero the same way `mining-economics.ts` guards its arithmetic:
 * a null/zero input never produces NaN or Infinity, and an unset target
 * surfaces as `null` ("unavailable"), never as a fabricated 0% or 100%.
 */

export interface FundraisingFacts {
  targetRaiseUsdc: number | null;
  minRaiseUsdc: number | null;
  /** DERIVED: SUM(Position.principalUsdc) for this vault, active positions only. */
  capitalRaisedUsdc: number;
  /** targetRaiseUsdc - capitalRaisedUsdc; null when no target is set. */
  remainingUsdc: number | null;
  /** capitalRaisedUsdc / targetRaiseUsdc * 100, clamped [0,100]; null when no target is set. */
  progressPct: number | null;
  /** COUNT(DISTINCT Position.investorId) for active positions on this vault. */
  investorCount: number;
  /** capitalRaisedUsdc >= minRaiseUsdc (false when minRaiseUsdc is unset). */
  minimumRaised: boolean;
  /** capitalRaisedUsdc >= targetRaiseUsdc (false when targetRaiseUsdc is unset). */
  targetReached: boolean;
  /** Passthrough from VaultDeployment.fundraisingStage. */
  fundraisingStage: string;
  openingDate: Date | null;
  closingDate: Date | null;
  distributionFrequency: string | null;
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Clamp a raised/target ratio to a [0, 100] percentage. Returns null when
 * `target` is missing or non-positive — a vault with no target set must show
 * progress as unavailable, never 0% or 100%.
 */
function computeProgressPct(
  raised: number,
  target: number | null,
): number | null {
  if (target === null || !Number.isFinite(target) || target <= 0) {
    return null;
  }
  const pct = (raised / target) * 100;
  if (!Number.isFinite(pct)) return null;
  return round2(Math.min(100, Math.max(0, pct)));
}

/**
 * targetRaiseUsdc - capitalRaisedUsdc. Null when no target is set — never a
 * negative-of-nothing or a fabricated remainder.
 */
function computeRemainingUsdc(
  raised: number,
  target: number | null,
): number | null {
  if (target === null || !Number.isFinite(target)) return null;
  return round2(target - raised);
}

export async function loadFundraisingFacts(
  vaultDeploymentId: string,
): Promise<FundraisingFacts | null> {
  const deployment = await prisma.vaultDeployment.findUnique({
    where: { id: vaultDeploymentId },
    select: {
      targetRaiseUsdc: true,
      minRaiseUsdc: true,
      fundraisingStage: true,
      openingDate: true,
      closingDate: true,
      distributionFrequency: true,
    },
  });

  if (!deployment) return null;

  const activeWhere = {
    vaultDeploymentId,
    status: "active",
  } as const;

  const [principalAgg, distinctInvestors] = await Promise.all([
    prisma.position.aggregate({
      _sum: { principalUsdc: true },
      where: activeWhere,
    }),
    prisma.position.findMany({
      where: activeWhere,
      select: { investorId: true },
      distinct: ["investorId"],
    }),
  ]);

  const capitalRaisedUsdc = round2(
    principalAgg._sum.principalUsdc?.toNumber() ?? 0,
  );
  const investorCount = distinctInvestors.length;

  const targetRaiseUsdc = deployment.targetRaiseUsdc?.toNumber() ?? null;
  const minRaiseUsdc = deployment.minRaiseUsdc?.toNumber() ?? null;

  const remainingUsdc = computeRemainingUsdc(capitalRaisedUsdc, targetRaiseUsdc);
  const progressPct = computeProgressPct(capitalRaisedUsdc, targetRaiseUsdc);

  const minimumRaised =
    minRaiseUsdc !== null && capitalRaisedUsdc >= minRaiseUsdc;
  const targetReached =
    targetRaiseUsdc !== null && capitalRaisedUsdc >= targetRaiseUsdc;

  return {
    targetRaiseUsdc,
    minRaiseUsdc,
    capitalRaisedUsdc,
    remainingUsdc,
    progressPct,
    investorCount,
    minimumRaised,
    targetReached,
    fundraisingStage: deployment.fundraisingStage,
    openingDate: deployment.openingDate ?? null,
    closingDate: deployment.closingDate ?? null,
    distributionFrequency: deployment.distributionFrequency ?? null,
  };
}
