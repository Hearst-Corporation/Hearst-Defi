import { describe, expect, it } from "vitest";

import { buildOverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { DashboardAllocation } from "@/lib/data/dashboard";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";

const EMPTY_TOTALS: PlatformTotals = {
  investorCount: 0,
  investedCapitalUsdc: 0,
};

const EMPTY_CLUSTERS: OverviewClusters = {
  totalCapacityUsdc: 0,
  pipelineCount: 0,
  kycApproved: 0,
  kycPending: 0,
  governance: { signing: 0, timelock: 0, executable: 0 },
  distributedTotalUsdc: 0,
  distributionsCount: 0,
};

const ALLOCATIONS: DashboardAllocation[] = [
  { bucket: "mining", pct: 60, valueUsdc: 600_000, yieldContributionBps: 0 },
  { bucket: "btc_tactical", pct: 25, valueUsdc: 250_000, yieldContributionBps: 0 },
  { bucket: "usdc_base", pct: 10, valueUsdc: 100_000, yieldContributionBps: 0 },
  { bucket: "stable_reserve", pct: 5, valueUsdc: 50_000, yieldContributionBps: 0 },
];

function find(view: ReturnType<typeof buildOverviewClustersView>, label: string) {
  for (const cluster of view.clusters) {
    const kpi = cluster.kpis.find((k) => k.label === label);
    if (kpi) return kpi;
  }
  return undefined;
}

describe("buildOverviewClustersView", () => {
  it("emits exactly 4 clusters in executive order with drill-down hrefs", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: EMPTY_CLUSTERS,
      allocations: [],
      allocationProvenance: "estimated",
    });
    expect(view.clusters.map((c) => c.label)).toEqual([
      "Capital",
      "Clients",
      "Governance",
      "Exposure",
    ]);
    expect(view.clusters.map((c) => c.href)).toEqual([
      "/admin/vaults",
      "/admin/customers",
      "/admin/governance",
      "/admin/distributions",
    ]);
    expect(view.caption).toBe("Platform · all vaults");
  });

  it("each cluster carries 3 KPIs, all with a provenance badge", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: EMPTY_CLUSTERS,
      allocations: ALLOCATIONS,
      allocationProvenance: "live",
    });
    for (const cluster of view.clusters) {
      expect(cluster.kpis).toHaveLength(3);
      for (const kpi of cluster.kpis) {
        expect(kpi.provenance).toBeTruthy();
      }
    }
  });

  it("empty DB degrades to honest placeholders — no -Infinity, no NaN, no throw", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: EMPTY_CLUSTERS,
      allocations: [],
      allocationProvenance: "estimated",
    });
    const flat = view.clusters.flatMap((c) => c.kpis);
    for (const kpi of flat) {
      expect(kpi.value).not.toContain("Infinity");
      expect(kpi.value).not.toContain("NaN");
    }
    expect(find(view, "Total AUM")!.value).toBe("—");
    expect(find(view, "Capacity used")!.value).toBe("—");
    expect(find(view, "Top allocation")!.value).toBe("—");
    expect(find(view, "Allocation breadth")!.value).toBe("—");
    expect(find(view, "Total distributed")!.value).toBe("—");
  });

  it("computes capacity used as a guarded ratio, labeled estimated", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 5, investedCapitalUsdc: 710_000 },
      clusters: { ...EMPTY_CLUSTERS, totalCapacityUsdc: 1_000_000 },
      allocations: ALLOCATIONS,
      allocationProvenance: "live",
    });
    const capacity = find(view, "Capacity used")!;
    expect(capacity.value).toBe("71%");
    expect(capacity.provenance).toBe("estimated");
  });

  it("flags KYC pending as alert and governance signing as alert", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 10, investedCapitalUsdc: 0 },
      clusters: {
        ...EMPTY_CLUSTERS,
        kycPending: 3,
        governance: { signing: 2, timelock: 1, executable: 0 },
      },
      allocations: ALLOCATIONS,
      allocationProvenance: "live",
    });
    expect(find(view, "Pending review")!.alert).toBe(true);
    expect(find(view, "Awaiting signature")!.alert).toBe(true);
    expect(find(view, "Timelock")!.accent).toBe(true);
  });

  it("allocation breadth counts only buckets over 5% (honest diversity signal)", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: EMPTY_CLUSTERS,
      allocations: ALLOCATIONS, // 60 / 25 / 10 / 5 → three are > 5%
      allocationProvenance: "live",
    });
    expect(find(view, "Allocation breadth")!.value).toBe("3");
    expect(find(view, "Top allocation")!.value).toBe("60%");
    expect(find(view, "Top allocation")!.sublabel).toBe("Mining");
  });

  it("ledger totals are provenance manual, allocation follows the chart provenance", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 4, investedCapitalUsdc: 500_000 },
      clusters: { ...EMPTY_CLUSTERS, distributedTotalUsdc: 2_410_000, distributionsCount: 9 },
      allocations: ALLOCATIONS,
      allocationProvenance: "live",
    });
    expect(find(view, "Total AUM")!.provenance).toBe("manual");
    expect(find(view, "Total investors")!.provenance).toBe("manual");
    expect(find(view, "Total distributed")!.provenance).toBe("manual");
    expect(find(view, "Total distributed")!.value).not.toBe("—");
    expect(find(view, "Top allocation")!.provenance).toBe("live");
  });
});
