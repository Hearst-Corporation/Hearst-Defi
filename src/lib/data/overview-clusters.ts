import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { getValidInvestorWhere } from "@/lib/data/investors";
import {
  loadUnavailable,
  type Loaded,
} from "@/lib/data/admin-dashboard-cache";

// ---------------------------------------------------------------------------
// Platform-wide aggregates for the admin dashboard executive overview band.
//
// Companion to `loadPlatformTotals` (investor count + invested capital): this
// loader covers the remaining cluster totals that otherwise live only on the
// dedicated admin pages (vaults / customers / governance):
//
//   - Capital   : total vault capacity, live-vault subscriptions, pipeline count.
//   - Clients   : KYC approved / pending counts (platform-wide, not page-scoped).
//   - Governance: proposal-state tally (signing / timelock / executable).
//   - Legacy    : retired payout-rail records (historical archive figures).
//
// All are operator-ledger records → provenance "manual" at the view layer.
// Decimal → number happens HERE at the data boundary. Per-request cached via
// React `cache`.
//
// Honesty policy: on a DB error this loader returns `unavailable` through the
// Loaded<T> envelope — NEVER a zero-filled shape. A dozen KPIs silently
// reading "0" during an outage is fabricated data; the dashboard renders
// "—" + an explicit banner instead.
// ---------------------------------------------------------------------------

export interface OverviewClusters {
  // Capital
  totalCapacityUsdc: number;
  /** Active-position principal held in LIVE deployments only — the numerator
   *  of "Capacity used". Same population as `totalCapacityUsdc` (live vaults):
   *  positions on fixture/legacy rails are excluded from BOTH sides, so the
   *  ratio can never exceed 100% by construction mismatch. */
  investedInLiveVaultsUsdc: number;
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
  // Legacy payout rail (retired) — historical archive records
  distributedTotalUsdc: number;
  distributionsCount: number;
}

export const loadOverviewClusters = cache(
  async (): Promise<Loaded<OverviewClusters>> => {
    try {
      // Valid investor population = investors whose linked User still exists
      // (same gate as loadPlatformTotals / loadCustomers) so KYC counts match
      // the customers table and never include orphaned Investor rows.
      const whereInvestors = await getValidInvestorWhere();

      const [
        capacityAgg,
        liveInvestedAgg,
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
        prisma.position.aggregate({
          _sum: { principalUsdc: true },
          where: {
            status: "active",
            investor: { is: whereInvestors },
            vaultDeployment: { is: { status: "live" } },
          },
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
        status: "ok",
        data: {
          totalCapacityUsdc: capacityAgg._sum.capacityUsdc?.toNumber() ?? 0,
          investedInLiveVaultsUsdc:
            liveInvestedAgg._sum.principalUsdc?.toNumber() ?? 0,
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
        },
      };
    } catch (err) {
      // DB unavailable — say so. Unreadable aggregates are NOT zeros.
      return loadUnavailable(err);
    }
  },
);
