import { allocationLabelFor } from "@/lib/allocation-colors";
import type { DashboardAllocation } from "@/lib/data/dashboard";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";
import { formatUsdCompact } from "@/lib/vaults/product-display";

import type { HeroKpi } from "./kpi-strip-view";

// ---------------------------------------------------------------------------
// Executive platform-overview band — presenter (UI view-model layer).
//
// Consolidates the platform-wide totals scattered across the dedicated admin
// pages into 4 labeled clusters of 3 HeroKpis each. All numbers are operator-
// ledger records (provenance "manual"); ratios/projections are "estimated";
// the dominant allocation flows from the chart-live provenance. Every formula
// is guarded for the empty-DB case (no -Infinity, no NaN, no throw).
//
// Scope: PLATFORM-WIDE (all vaults). The band carries a "Platform · all vaults"
// caption so it reads correctly even when the top rows are vault-scoped by the
// `?vault=` pill.
// ---------------------------------------------------------------------------

export interface OverviewClustersView {
  caption: string;
  clusters: OverviewCluster[];
}

export interface OverviewCluster {
  /** Cluster label (pane header). */
  label: string;
  /** Drill-down target for the "View full →" leaf link. */
  href: string;
  kpis: HeroKpi[];
}

/** Dominant allocation provenance, as resolved on the board. */
export type AllocationProvenance = "live" | "simulated" | "estimated";

export function buildOverviewClustersView(input: {
  totals: PlatformTotals;
  clusters: OverviewClusters;
  /** Allocation buckets already loaded on the page (vault-scoped donut data). */
  allocations: DashboardAllocation[];
  /** Provenance of the dominant-allocation read (mirrors the donut). */
  allocationProvenance: AllocationProvenance;
}): OverviewClustersView {
  const { totals, clusters, allocations, allocationProvenance } = input;

  return {
    caption: "Platform · all vaults",
    clusters: [
      buildCapitalCluster(totals, clusters),
      buildClientsCluster(totals, clusters),
      buildGovernanceCluster(clusters),
      buildExposureCluster(allocations, allocationProvenance, clusters),
    ],
  };
}

function buildCapitalCluster(
  totals: PlatformTotals,
  clusters: OverviewClusters,
): OverviewCluster {
  const { investedCapitalUsdc } = totals;
  const { totalCapacityUsdc, pipelineCount } = clusters;

  const capacityPct =
    totalCapacityUsdc > 0
      ? Math.round((investedCapitalUsdc / totalCapacityUsdc) * 100)
      : null;

  return {
    label: "Capital",
    href: "/admin/vaults",
    kpis: [
      {
        label: "Total AUM",
        value: investedCapitalUsdc > 0 ? formatUsdCompact(investedCapitalUsdc) : "—",
        sublabel: "deployed across vaults",
        provenance: "manual",
      },
      {
        label: "Capacity used",
        value: capacityPct !== null ? `${capacityPct}%` : "—",
        sublabel:
          totalCapacityUsdc > 0
            ? `of ${formatUsdCompact(totalCapacityUsdc)} total`
            : "no capacity set",
        provenance: "estimated",
      },
      {
        label: "In pipeline",
        value: String(pipelineCount),
        sublabel: "draft or in review",
        provenance: "manual",
        accent: pipelineCount > 0,
      },
    ],
  };
}

function buildClientsCluster(
  totals: PlatformTotals,
  clusters: OverviewClusters,
): OverviewCluster {
  const { investorCount } = totals;
  const { kycApproved, kycPending } = clusters;

  return {
    label: "Clients",
    href: "/admin/customers",
    kpis: [
      {
        label: "Total investors",
        value: investorCount > 0 ? String(investorCount) : "—",
        sublabel:
          investorCount === 1 ? "registered account" : "registered accounts",
        provenance: "manual",
      },
      {
        label: "KYC approved",
        value: String(kycApproved),
        sublabel: investorCount > 0 ? `of ${investorCount} total` : "no investors yet",
        provenance: "manual",
        accent: kycApproved > 0,
      },
      {
        label: "Pending review",
        value: String(kycPending),
        sublabel: "KYC awaiting action",
        provenance: "manual",
        alert: kycPending > 0,
      },
    ],
  };
}

function buildGovernanceCluster(clusters: OverviewClusters): OverviewCluster {
  const { signing, timelock, executable } = clusters.governance;

  return {
    label: "Governance",
    href: "/admin/governance",
    kpis: [
      {
        label: "Awaiting signature",
        value: String(signing),
        sublabel: "needs operator",
        provenance: "manual",
        alert: signing > 0,
      },
      {
        label: "Timelock",
        value: String(timelock),
        sublabel: "pending execution window",
        provenance: "manual",
        accent: timelock > 0,
      },
      {
        label: "Executable",
        value: String(executable),
        sublabel: "ready to run",
        provenance: "manual",
        accent: executable > 0,
      },
    ],
  };
}

function buildExposureCluster(
  allocations: DashboardAllocation[],
  allocationProvenance: AllocationProvenance,
  clusters: OverviewClusters,
): OverviewCluster {
  const { distributedTotalUsdc, distributionsCount } = clusters;

  // Dominant bucket — guarded reduce (no seedless throw, no empty crash).
  const top =
    allocations.length > 0
      ? allocations.reduce((max, cur) => (cur.pct > max.pct ? cur : max))
      : null;

  // Honest diversity signal (replaces the unfair 2-way "BTC vs stable" split:
  // the 4 buckets do NOT partition into two clean sides). Count buckets above a
  // 5% weight — a real concentration vs spread indicator.
  const breadth = allocations.filter((a) => a.pct > 5).length;

  return {
    label: "Exposure",
    href: "/admin/distributions",
    kpis: [
      {
        label: "Top allocation",
        value: top ? `${top.pct.toFixed(0)}%` : "—",
        sublabel: top ? allocationLabelFor(top.bucket) : "awaiting allocation",
        provenance: top ? allocationProvenance : "stale",
      },
      {
        label: "Allocation breadth",
        value: breadth > 0 ? String(breadth) : "—",
        sublabel: breadth === 1 ? "bucket over 5%" : "buckets over 5%",
        provenance: top ? allocationProvenance : "stale",
      },
      {
        label: "Total distributed",
        value: distributedTotalUsdc > 0 ? formatUsdCompact(distributedTotalUsdc) : "—",
        sublabel:
          distributionsCount === 1
            ? "across 1 distribution"
            : `across ${distributionsCount} distributions`,
        provenance: "manual",
        accent: distributedTotalUsdc > 0,
      },
    ],
  };
}
