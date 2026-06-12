import { describe, expect, it } from "vitest";

import {
  resolveCapitalProvenance,
  resolveDashboardPageInputs,
  resolveHeadlineApy,
  resolveYieldPosture,
} from "@/lib/admin/dashboard-page-view";
import type { AdminOverview } from "@/lib/data/admin-overview";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

const RISK: RiskFrameworkData = {
  composite: 47,
  band: "medium",
  bandLabel: "Medium",
  dimensions: [],
  source: "db",
};

const OVERVIEW: AdminOverview = {
  actions: [],
  totalActionRequired: 0,
  proof: {
    lastMiningAttestationAt: null,
    miningFreshness: "stale",
    attestationsCount: 0,
    proofsTotal: 0,
    custodyConfigured: false,
    custodyProvenance: "manual",
    custodyReservesUsdc: 0,
  },
};

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    vault: {
      aumUsdc: 500_000,
      delta30dUsdc: 0,
      apyRange: { low: 9.4, high: 12.8 },
      stressedApy: 5.2,
      stressedApyRange: { low: 4.4, high: 6.0 },
      riskScore: 47,
      miningMarginScore: 60,
      mode: "balanced",
      asOf: new Date("2026-06-01T00:00:00Z"),
    },
    vaultMeta: {
      id: "yield",
      name: "Hearst Yield Vault",
      apyTarget: { low: 8, high: 15 },
      allocationTargets: { mining: 40, btc_tactical: 0, usdc_base: 60, stable_reserve: 0 },
      assumptions: [],
      livePreview: false,
    },
    allocations: [],
    miningOps: {
      hashrate_ph_s: 0,
      uptime_pct: 0,
      margin_score: 60,
      attestations_count: 0,
      hashprice: null,
      is_fallback: true,
    },
    hashpriceTrendPct: 0,
    operationalConfidence: 0,
    latestDistribution: null,
    monthlyHistory: [],
    btcPrice: {
      usd: 0,
      usd_24h_change: 0,
      fetched_at: new Date("2026-06-01T00:00:00Z"),
      stale: true,
      provenance: "stale",
    },
    recentEvents: [],
    timeseries: { nav30d: [], apy30d: [], source: "fallback" },
    source: "db",
    hasTimelineSnapshot: true,
    ...overrides,
  };
}

describe("resolveHeadlineApy", () => {
  const vaultApy = { low: 9.4, high: 12.8 };
  const apyTarget = { low: 8, high: 15 };

  it("returns vault APY when live KPIs exist", () => {
    expect(resolveHeadlineApy(vaultApy, apyTarget, true, false)).toEqual(vaultApy);
  });

  it("returns methodology target in live preview without live KPIs", () => {
    expect(resolveHeadlineApy(vaultApy, apyTarget, false, true)).toEqual(apyTarget);
  });

  it("returns null when no snapshot and not in preview", () => {
    expect(resolveHeadlineApy(vaultApy, apyTarget, false, false)).toBeNull();
  });
});

describe("resolveYieldPosture", () => {
  const apyTarget = { low: 8, high: 15 };

  it("labels preview vaults without APY as methodology preset", () => {
    expect(resolveYieldPosture(null, apyTarget, true)).toBe("methodology preset");
  });

  it("labels empty yield vault as awaiting first snapshot", () => {
    expect(resolveYieldPosture(null, apyTarget, false)).toBe("awaiting first snapshot");
  });

  it("detects APY within target band", () => {
    expect(resolveYieldPosture({ low: 9, high: 12 }, apyTarget, false)).toBe(
      "within target band",
    );
  });
});

describe("resolveCapitalProvenance", () => {
  it("marks preview vault capital as estimated", () => {
    expect(resolveCapitalProvenance(true, false, "live", true, 500_000)).toBe(
      "estimated",
    );
  });

  it("prefers custody provenance when reserves are configured", () => {
    expect(resolveCapitalProvenance(false, true, "live", true, 250_000)).toBe("live");
  });

  it("falls back to manual when no live KPIs and zero AUM", () => {
    expect(resolveCapitalProvenance(false, false, "manual", false, 0)).toBe("manual");
  });
});

describe("resolveDashboardPageInputs", () => {
  it("sets preview + estimated capital for non-yield fixture vaults", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        vaultMeta: {
          id: "defensive",
          name: "Hearst Defensive Vault",
          apyTarget: { low: 6, high: 10 },
          allocationTargets: {
            mining: 20,
            btc_tactical: 0,
            usdc_base: 50,
            stable_reserve: 30,
          },
          assumptions: [],
          livePreview: true,
        },
      }),
      RISK,
      OVERVIEW,
    );

    expect(page.preview).toBe(true);
    expect(page.hasLiveKpis).toBe(false);
    expect(page.headlineApy).toEqual({ low: 6, high: 10 });
    expect(page.capitalProvenance).toBe("estimated");
    expect(page.yieldPosture).toBe("within target band");
  });

  it("marks proof fresh when mining attestation is live", () => {
    const page = resolveDashboardPageInputs(
      makeData(),
      RISK,
      {
        ...OVERVIEW,
        proof: {
          ...OVERVIEW.proof,
          miningFreshness: "live",
          attestationsCount: 2,
        },
      },
    );

    expect(page.proofFresh).toBe(true);
    expect(page.hasLiveKpis).toBe(true);
    expect(page.capitalProvenance).toBe("live");
  });
});
