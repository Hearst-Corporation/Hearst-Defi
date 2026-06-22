import type { DashboardData } from "@/lib/data/dashboard";

/**
 * Whether the allocation orbit may render vault data.
 * Live → production timeline; seed preview → DB snapshot with simulated badge.
 */
export function resolveAllocationChartLive(
  hasLiveKpis: boolean,
  hasSeedPreview: boolean,
  data: Pick<DashboardData, "source" | "allocations">,
  capitalUsdc: number,
): boolean {
  if (capitalUsdc <= 0 || data.allocations.length === 0) return false;
  if (hasLiveKpis) {
    return data.source === "db";
  }
  if (hasSeedPreview) {
    return data.source !== "fallback";
  }
  return false;
}

/** Whether the NAV bar chart may render vault series. */
export function resolveNavChartLive(
  hasLiveKpis: boolean,
  hasSeedPreview: boolean,
  timeseries: DashboardData["timeseries"],
): boolean {
  if (timeseries.nav30d.length < 2) return false;
  if (hasLiveKpis) {
    return timeseries.source === "db";
  }
  if (hasSeedPreview) {
    return timeseries.source === "db";
  }
  return false;
}
