import { describe, expect, it } from "vitest";

import { buildOverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { Loaded } from "@/lib/data/admin-dashboard-cache";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";

const EMPTY_TOTALS: PlatformTotals = {
  investorCount: 0,
  investedCapitalUsdc: 0,
};

const EMPTY_CLUSTERS: OverviewClusters = {
  totalCapacityUsdc: 0,
  investedInLiveVaultsUsdc: 0,
  pipelineCount: 0,
  kycApproved: 0,
  kycPending: 0,
  governance: { signing: 0, timelock: 0, executable: 0 },
  distributedTotalUsdc: 0,
  distributionsCount: 0,
};

function ok(data: OverviewClusters): Loaded<OverviewClusters> {
  return { status: "ok", data };
}

const UNAVAILABLE: Loaded<OverviewClusters> = {
  status: "unavailable",
  reason: "db_error",
};

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
      clusters: ok(EMPTY_CLUSTERS),
    });
    expect(view.clusters.map((c) => c.label)).toEqual([
      "Capital",
      "Clients",
      "Governance",
      "Legacy rail",
    ]);
    expect(view.clusters.map((c) => c.href)).toEqual([
      "/admin/vaults",
      "/admin/customers",
      "/admin/governance",
      "/admin/distributions",
    ]);
    expect(view.caption).toBe("Platform · all vaults");
    expect(view.unavailable).toBe(false);
  });

  it("every KPI carries a provenance badge", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: ok(EMPTY_CLUSTERS),
    });
    for (const cluster of view.clusters) {
      expect(cluster.kpis.length).toBeGreaterThan(0);
      for (const kpi of cluster.kpis) {
        expect(kpi.provenance).toBeTruthy();
      }
    }
  });

  it("empty DB degrades to honest placeholders — no -Infinity, no NaN, no throw", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: ok(EMPTY_CLUSTERS),
    });
    const flat = view.clusters.flatMap((c) => c.kpis);
    for (const kpi of flat) {
      expect(kpi.value).not.toContain("Infinity");
      expect(kpi.value).not.toContain("NaN");
    }
    expect(find(view, "Total AUM")!.value).toBe("—");
    expect(find(view, "Capacity used")!.value).toBe("—");
    expect(find(view, "Legacy payouts (retired rail)")!.value).toBe("—");
  });

  it("the structurally dead allocation cells are gone (page always passed [])", () => {
    const view = buildOverviewClustersView({
      totals: EMPTY_TOTALS,
      clusters: ok(EMPTY_CLUSTERS),
    });
    expect(find(view, "Top allocation")).toBeUndefined();
    expect(find(view, "Allocation breadth")).toBeUndefined();
  });

  it("capacity used compares live-vault subscriptions to live-vault capacity (same population)", () => {
    const view = buildOverviewClustersView({
      // Platform-wide capital is BIGGER than the live-vault capital — the
      // ratio must use the live-vault numerator, not this figure.
      totals: { investorCount: 5, investedCapitalUsdc: 5_000_000 },
      clusters: ok({
        ...EMPTY_CLUSTERS,
        totalCapacityUsdc: 1_000_000,
        investedInLiveVaultsUsdc: 710_000,
      }),
    });
    const capacity = find(view, "Capacity used")!;
    expect(capacity.value).toBe("71%");
    expect(capacity.provenance).toBe("estimated");
    expect(capacity.sublabel).toContain("live-vault capacity");
  });

  it("flags KYC pending as alert and governance signing as alert", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 10, investedCapitalUsdc: 0 },
      clusters: ok({
        ...EMPTY_CLUSTERS,
        kycPending: 3,
        governance: { signing: 2, timelock: 1, executable: 0 },
      }),
    });
    expect(find(view, "Pending review")!.alert).toBe(true);
    expect(find(view, "Awaiting signature")!.alert).toBe(true);
    expect(find(view, "Timelock")!.accent).toBe(true);
  });

  it("legacy payouts cell is labeled as the retired rail with record counts", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 4, investedCapitalUsdc: 500_000 },
      clusters: ok({
        ...EMPTY_CLUSTERS,
        distributedTotalUsdc: 2_410_000,
        distributionsCount: 9,
      }),
    });
    const legacy = find(view, "Legacy payouts (retired rail)")!;
    expect(legacy.provenance).toBe("manual");
    expect(legacy.value).not.toBe("—");
    expect(legacy.sublabel).toBe("9 historical records");
  });

  it("DB outage → unavailable:true, cluster cells are '—' + stale, NEVER zero", () => {
    const view = buildOverviewClustersView({
      totals: { investorCount: 7, investedCapitalUsdc: 900_000 },
      clusters: UNAVAILABLE,
    });
    expect(view.unavailable).toBe(true);

    // Cells sourced from the failed loader: absent + stale.
    for (const label of [
      "Capacity used",
      "In pipeline",
      "KYC approved",
      "Pending review",
      "Awaiting signature",
      "Timelock",
      "Executable",
      "Legacy payouts (retired rail)",
    ]) {
      const kpi = find(view, label)!;
      expect(kpi.value).toBe("—");
      expect(kpi.value).not.toBe("0");
      expect(kpi.provenance).toBe("stale");
      expect(kpi.sublabel).toContain("unavailable");
    }

    // Cells sourced from the totals loader (which did succeed) keep real data.
    expect(find(view, "Total AUM")!.value).not.toBe("—");
    expect(find(view, "Total investors")!.value).toBe("7");
  });
});
