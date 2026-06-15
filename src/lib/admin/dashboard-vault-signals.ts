import type { DashboardAllocation, DashboardAllocationBucket, DashboardData } from "@/lib/data/dashboard";

/** Zeroed allocation rows for vault-chart placeholder state (all four sleeves). */
export const DASHBOARD_ZERO_ALLOCATIONS: DashboardAllocation[] = (
  ["mining", "usdc_base", "btc_tactical", "stable_reserve"] satisfies DashboardAllocationBucket[]
).map((bucket) => ({
  bucket,
  pct: 0,
  valueUsdc: 0,
  yieldContributionBps: 0,
}));

/**
 * Whether the allocation orbit may render live vault data.
 * Gated on `hasLiveKpis` — same honesty contract as the KPI strip
 * (`hasLiveTimelineSnapshot && !livePreview`).
 */
export function resolveAllocationChartLive(
  hasLiveKpis: boolean,
  data: Pick<DashboardData, "source" | "allocations">,
  capitalUsdc: number,
): boolean {
  return (
    hasLiveKpis &&
    data.source === "db" &&
    capitalUsdc > 0 &&
    data.allocations.length > 0
  );
}

/** Whether the NAV bar chart may render live vault series. */
export function resolveNavChartLive(
  hasLiveKpis: boolean,
  timeseries: DashboardData["timeseries"],
): boolean {
  return hasLiveKpis && timeseries.source === "db" && timeseries.nav30d.length >= 2;
}
