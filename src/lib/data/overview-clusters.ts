import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Platform-wide aggregates for the admin dashboard executive overview band.
//
// Companion to `loadPlatformTotals` (investor count + invested capital): this
// loader covers the remaining cluster totals that otherwise live only on the
// dedicated admin pages (vaults / customers / governance / distributions):
//
//   - Capital   : total vault capacity, pipeline (draft/review) count.
//   - Clients   : KYC approved / pending counts (platform-wide, not page-scoped).
//   - Governance: proposal-state tally (signing / timelock / executable).
//   - Exposure  : total distributed + distribution count.
//
// All are operator-ledger records → provenance "manual" at the view layer.
// Decimal → number happens HERE at the data boundary. Per-request cached via
// React `cache`. Never throws: on any DB error the whole shape degrades to
// zeros (same never-crash doctrine as the cockpit loaders) so the dashboard
// renders honest "—"/0 instead of a 500.
// ---------------------------------------------------------------------------

export interface OverviewClusters {
  // Capital
  totalCapacityUsdc: number;
  pipelineCount: number;
  // Clients (platform-wide, mirrors loadPlatformTotals' valid-investor gate)
  kycApproved: number;
  kycPending: number;
  // Governance (state machine tally)
  governance: {
    signing: number;
    timelock: number;
    executable: number;
  };
  // Exposure
  distributedTotalUsdc: number;
  distributionsCount: number;
}

const EMPTY: OverviewClusters = {
  totalCapacityUsdc: 0,
  pipelineCount: 0,
  kycApproved: 0,
  kycPending: 0,
  governance: { signing: 0, timelock: 0, executable: 0 },
  distributedTotalUsdc: 0,
  distributionsCount: 0,
};

export const loadOverviewClusters = cache(
  async (): Promise<OverviewClusters> => {
    try {
      // Valid investor population = investors whose linked User still exists
      // (same gate as loadPlatformTotals / loadCustomers) so KYC counts match
      // the customers table and never include orphaned Investor rows.
      const validUserIds = (
        await prisma.user.findMany({
          where: { investor: { isNot: null } },
          select: { id: true },
        })
      ).map((u) => u.id);

      const whereInvestors = { userId: { in: validUserIds } };

      const [
        capacityAgg,
        pipelineCount,
        kycApproved,
        kycPending,
        proposalStates,
        distributionAgg,
      ] = await Promise.all([
        prisma.vaultDeployment.aggregate({
          _sum: { capacityUsdc: true },
          where: { status: "live" },
        }),
        prisma.vaultDeployment.count({
          where: { status: { in: ["draft", "review"] } },
        }),
        prisma.investor.count({
          where: { ...whereInvestors, kycStatus: "approved" },
        }),
        prisma.investor.count({
          where: { ...whereInvestors, kycStatus: "pending" },
        }),
        prisma.governanceProposal.groupBy({
          by: ["state"],
          _count: { _all: true },
        }),
        prisma.distribution.aggregate({
          _sum: { amountUsdc: true },
          _count: { _all: true },
        }),
      ]);

      // Tally proposal states into the three actionable buckets.
      const byState = new Map<string, number>(
        proposalStates.map((row) => [row.state, row._count._all]),
      );

      return {
        totalCapacityUsdc: capacityAgg._sum.capacityUsdc?.toNumber() ?? 0,
        pipelineCount,
        kycApproved,
        kycPending,
        governance: {
          signing: byState.get("SIGNING") ?? 0,
          timelock: byState.get("TIMELOCK") ?? 0,
          executable: byState.get("EXECUTABLE") ?? 0,
        },
        distributedTotalUsdc: distributionAgg._sum.amountUsdc?.toNumber() ?? 0,
        distributionsCount: distributionAgg._count._all,
      };
    } catch {
      // DB unavailable / empty — degrade to zeros, never crash the dashboard.
      return EMPTY;
    }
  },
);
