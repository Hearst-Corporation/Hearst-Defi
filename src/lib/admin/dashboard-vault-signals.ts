import type { DashboardData } from "@/lib/data/dashboard";

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
