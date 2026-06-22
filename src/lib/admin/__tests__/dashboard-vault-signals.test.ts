import { describe, expect, it } from "vitest";

import {
  resolveAllocationChartLive,
  resolveNavChartLive,
} from "@/lib/admin/dashboard-vault-signals";
import type { DashboardData } from "@/lib/data/dashboard";

const DB_ALLOCATIONS: DashboardData["allocations"] = [
  { bucket: "mining", pct: 40, valueUsdc: 200_000, yieldContributionBps: 0 },
  { bucket: "usdc_base", pct: 60, valueUsdc: 300_000, yieldContributionBps: 0 },
];

describe("resolveAllocationChartLive", () => {
  it("returns false without live or seed preview even when DB rows exist", () => {
    expect(
      resolveAllocationChartLive(
        false,
        false,
        { source: "db", allocations: DB_ALLOCATIONS },
        500_000,
      ),
    ).toBe(false);
  });

  it("returns true when live KPIs and DB allocations are present", () => {
    expect(
      resolveAllocationChartLive(
        true,
        false,
        { source: "db", allocations: DB_ALLOCATIONS },
        500_000,
      ),
    ).toBe(true);
  });

  it("returns true for seed preview when partial source still has allocations", () => {
    expect(
      resolveAllocationChartLive(
        false,
        true,
        { source: "partial", allocations: DB_ALLOCATIONS },
        500_000,
      ),
    ).toBe(true);
  });

  it("returns false for seed preview when source is fallback", () => {
    expect(
      resolveAllocationChartLive(
        false,
        true,
        { source: "fallback", allocations: DB_ALLOCATIONS },
        500_000,
      ),
    ).toBe(false);
  });
});

describe("resolveNavChartLive", () => {
  const navSeries: DashboardData["timeseries"] = {
    source: "db",
    nav30d: [
      { date: "2026-05-01", aum_usdc: 400_000 },
      { date: "2026-05-15", aum_usdc: 500_000 },
    ],
    apy30d: [],
  };

  it("returns false without live or seed preview even when NAV series exists", () => {
    expect(resolveNavChartLive(false, false, navSeries)).toBe(false);
  });

  it("returns true when live KPIs and NAV series are present", () => {
    expect(resolveNavChartLive(true, false, navSeries)).toBe(true);
  });

  it("returns true for seed preview when NAV series is DB-backed", () => {
    expect(resolveNavChartLive(false, true, navSeries)).toBe(true);
  });
});
