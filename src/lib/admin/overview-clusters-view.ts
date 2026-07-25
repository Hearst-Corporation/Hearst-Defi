import type { Loaded } from "@/lib/data/admin-dashboard-cache";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";
import { formatUsdCompact } from "@/lib/vaults/product-display";

import type { HeroKpi } from "./kpi-strip-view";

// ---------------------------------------------------------------------------
// Executive platform-overview band — presenter (UI view-model layer).
//
// Consolidates the platform-wide totals scattered across the dedicated admin
// pages into 4 labeled clusters of HeroKpis. All numbers are operator-ledger
// records (provenance "manual"); ratios are "estimated". Every formula is
// guarded for the empty-DB case (no -Infinity, no NaN, no throw).
//
// Honesty:
//   - `clusters` arrives as Loaded<OverviewClusters>: when the DB read failed
//     every cluster-sourced cell renders "—" with a `stale` badge and the view
//     model carries `unavailable: true` so the page shows an explicit banner.
//     NEVER a zero during an outage. Cells sourced from `totals` (a separate
//     loader that throws loudly on failure) keep their real values.
//   - The former Exposure cells "Top allocation" / "Allocation breadth" were
//     structurally dead: the only caller passed `allocations: []` forever, so
//     they always rendered "—" while pretending to await data. Removed
//     2026-07-26 (mission E1) together with the unused `allocationProvenance`
//     input.
//   - "Total distributed" is relabeled "Legacy payouts (retired rail)": the
//     figure aggregates records of the RETIRED payout rail (some with 0xMOCK
//     tx hashes) — it is a historical archive figure, not a live product
//     metric. Recommended for deletion (arbitrage Adrien, D10).
//
// Scope: PLATFORM-WIDE (all vaults). The band carries a "Platform · all vaults"
// caption so it reads correctly even when the top rows are vault-scoped by the
// `?vault=` pill.
// ---------------------------------------------------------------------------

export interface OverviewClustersView {
  caption: string;
  /** True when the clusters DB read failed — the page renders an explicit
   *  "Aggregates unavailable" banner above the band. */
  unavailable: boolean;
  clusters: OverviewCluster[];
}

export interface OverviewCluster {
  /** Cluster label (pane header). */
  label: string;
  /** Drill-down target for the "View full →" leaf link. */
  href: string;
  kpis: HeroKpi[];
}

/** Cell rendered when the clusters read failed — absent, never zero. */
function unavailableKpi(label: string): HeroKpi {
  return {
    label,
    value: "—",
    sublabel: "unavailable — database read failed",
    provenance: "stale",
  };
}

export function buildOverviewClustersView(input: {
  totals: PlatformTotals;
  clusters: Loaded<OverviewClusters>;
}): OverviewClustersView {
  const { totals } = input;
  const clusters =
    input.clusters.status === "ok" ? input.clusters.data : null;

  return {
    caption: "Platform · all vaults",
    unavailable: clusters === null,
    clusters: [
      buildCapitalCluster(totals, clusters),
      buildClientsCluster(totals, clusters),
      buildGovernanceCluster(clusters),
      buildLegacyPayoutsCluster(clusters),
    ],
  };
}

function buildCapitalCluster(
  totals: PlatformTotals,
  clusters: OverviewClusters | null,
): OverviewCluster {
  const { investedCapitalUsdc } = totals;

  const kpis: HeroKpi[] = [
    {
      label: "Total AUM",
      value: investedCapitalUsdc > 0 ? formatUsdCompact(investedCapitalUsdc) : "—",
      sublabel: "deployed across vaults",
      provenance: "manual",
    },
  ];

  if (clusters === null) {
    kpis.push(unavailableKpi("Capacity used"), unavailableKpi("In pipeline"));
    return { label: "Capital", href: "/admin/vaults", kpis };
  }

  const { totalCapacityUsdc, investedInLiveVaultsUsdc, pipelineCount } = clusters;

  // Numerator AND denominator on the SAME population (live deployments):
  // live-vault subscriptions over live-vault capacity. Fixture/legacy-rail
  // positions are excluded from both sides — see OverviewClusters docs.
  const capacityPct =
    totalCapacityUsdc > 0
      ? Math.round((investedInLiveVaultsUsdc / totalCapacityUsdc) * 100)
      : null;

  kpis.push(
    {
      label: "Capacity used",
      value: capacityPct !== null ? `${capacityPct}%` : "—",
      sublabel:
        totalCapacityUsdc > 0
          ? `of ${formatUsdCompact(totalCapacityUsdc)} live-vault capacity`
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
  );

  return { label: "Capital", href: "/admin/vaults", kpis };
}

function buildClientsCluster(
  totals: PlatformTotals,
  clusters: OverviewClusters | null,
): OverviewCluster {
  const { investorCount } = totals;

  const kpis: HeroKpi[] = [
    {
      label: "Total investors",
      value: investorCount > 0 ? String(investorCount) : "—",
      sublabel:
        investorCount === 1 ? "registered account" : "registered accounts",
      provenance: "manual",
    },
  ];

  if (clusters === null) {
    kpis.push(unavailableKpi("KYC approved"), unavailableKpi("Pending review"));
    return { label: "Clients", href: "/admin/customers", kpis };
  }

  const { kycApproved, kycPending } = clusters;

  kpis.push(
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
  );

  return { label: "Clients", href: "/admin/customers", kpis };
}

function buildGovernanceCluster(
  clusters: OverviewClusters | null,
): OverviewCluster {
  if (clusters === null) {
    return {
      label: "Governance",
      href: "/admin/governance",
      kpis: [
        unavailableKpi("Awaiting signature"),
        unavailableKpi("Timelock"),
        unavailableKpi("Executable"),
      ],
    };
  }

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

function buildLegacyPayoutsCluster(
  clusters: OverviewClusters | null,
): OverviewCluster {
  if (clusters === null) {
    return {
      label: "Legacy rail",
      href: "/admin/distributions",
      kpis: [unavailableKpi("Legacy payouts (retired rail)")],
    };
  }

  const { distributedTotalUsdc, distributionsCount } = clusters;

  return {
    label: "Legacy rail",
    href: "/admin/distributions",
    kpis: [
      {
        label: "Legacy payouts (retired rail)",
        value: distributedTotalUsdc > 0 ? formatUsdCompact(distributedTotalUsdc) : "—",
        sublabel:
          distributionsCount === 1
            ? "1 historical record"
            : `${distributionsCount} historical records`,
        provenance: "manual",
      },
    ],
  };
}
