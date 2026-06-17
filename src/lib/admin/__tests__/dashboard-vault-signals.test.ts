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
  it("returns false without hasLiveKpis even when DB rows exist", () => {
    expect(
      resolveAllocationChartLive(
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
        { source: "db", allocations: DB_ALLOCATIONS },
        500_000,
      ),
    ).toBe(true);
  });
});

describe("resolveNavChartLive", () => {
  it("returns false without hasLiveKpis even when NAV series exists", () => {
    expect(
      resolveNavChartLive(false, {
        source: "db",
        nav30d: [
          { date: "2026-05-01", aum_usdc: 400_000 },
          { date: "2026-05-15", aum_usdc: 500_000 },
        ],
        apy30d: [],
      }),
    ).toBe(false);
  });

  it("returns true when live KPIs and NAV series are present", () => {
    expect(
      resolveNavChartLive(true, {
        source: "db",
        nav30d: [
          { date: "2026-05-01", aum_usdc: 400_000 },
          { date: "2026-05-15", aum_usdc: 500_000 },
        ],
        apy30d: [],
      }),
    ).toBe(true);
  });
});
