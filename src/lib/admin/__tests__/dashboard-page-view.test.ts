import { describe, expect, it } from "vitest";

import {
  resolveCapitalProvenance,
  resolveDashboardDataNotice,
  resolveDashboardPageInputs,
  resolveHeadlineApy,
  resolveYieldPosture,
} from "@/lib/admin/dashboard-page-view";
import type { AdminOverview } from "@/lib/data/admin-overview";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import { isLiveTimelineSource } from "@/lib/data/timeline-snapshot";
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
    latestSnapshotSource: "live",
    hasLiveTimelineSnapshot: true,
    ...overrides,
  };
}

const COCKPIT_EMPTY: CockpitPayload = {
  actionQueue: [],
  vaultMetrics: [],
  inngestJobs: [],
  sentryStats: { errors24h: 0, warnings24h: 0 },
  onChainEvents: [],
  auditTrail: [],
};

describe("resolveDashboardDataNotice", () => {
  it("returns preview notice for livePreview vaults", () => {
    expect(
      resolveDashboardDataNotice(
        makeData({
          vaultMeta: {
            id: "defensive",
            name: "Hearst Defensive Vault",
            apyTarget: { low: 5, high: 8 },
            allocationTargets: {
              mining: 20,
              btc_tactical: 10,
              usdc_base: 35,
              stable_reserve: 35,
            },
            assumptions: ["Not guaranteed."],
            livePreview: true,
          },
        }),
        OVERVIEW,
        COCKPIT_EMPTY,
        false,
        true,
      ),
    ).toEqual({
      kind: "preview",
      vaultName: "Hearst Defensive Vault",
    });
  });

  it("returns staging notice for daily-seed snapshots", () => {
    expect(
      resolveDashboardDataNotice(
        makeData({
          hasTimelineSnapshot: true,
          latestSnapshotSource: "daily-seed",
          hasLiveTimelineSnapshot: false,
        }),
        OVERVIEW,
        COCKPIT_EMPTY,
        false,
        false,
      ),
    ).toEqual({
      kind: "staging",
      snapshotSource: "daily-seed",
    });
  });

  it("returns mixed-platform notice when ops data exists without live vault KPIs", () => {
    expect(
      resolveDashboardDataNotice(
        makeData({
          hasTimelineSnapshot: false,
          latestSnapshotSource: null,
          hasLiveTimelineSnapshot: false,
        }),
        {
          ...OVERVIEW,
          proof: { ...OVERVIEW.proof, attestationsCount: 1 },
        },
        COCKPIT_EMPTY,
        false,
        false,
      ),
    ).toMatchObject({
      kind: "mixed-platform",
      vaultName: "Hearst Yield Vault",
    });
  });

  it("returns null when live KPIs are active", () => {
    expect(
      resolveDashboardDataNotice(
        makeData({ hasLiveTimelineSnapshot: true }),
        OVERVIEW,
        COCKPIT_EMPTY,
        true,
        false,
      ),
    ).toBeNull();
  });
});

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

// ---------------------------------------------------------------------------
// Seed honesty — daily-seed must not trigger Live KPI signals
// ---------------------------------------------------------------------------

describe("proofFresh gate — seed context", () => {
  const FRESH_PROOF_OVERVIEW: AdminOverview = {
    ...OVERVIEW,
    proof: {
      ...OVERVIEW.proof,
      miningFreshness: "live",
      attestationsCount: 3,
      proofsTotal: 3,
    },
  };

  it("seed context with recent proof rows does not produce proofFresh=true", () => {
    // daily-seed snapshot + fresh proof rows → must NOT activate Attested
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "daily-seed",
        hasLiveTimelineSnapshot: false,
      }),
      RISK,
      FRESH_PROOF_OVERVIEW,
    );
    expect(page.proofFresh).toBe(false);
    expect(page.hasLiveKpis).toBe(false);
  });

  it("null snapshot context with recent proof rows does not produce proofFresh=true", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: false,
        latestSnapshotSource: null,
        hasLiveTimelineSnapshot: false,
      }),
      RISK,
      FRESH_PROOF_OVERVIEW,
    );
    expect(page.proofFresh).toBe(false);
  });

  it("live snapshot context with recent proof rows preserves proofFresh=true", () => {
    // Real production data → Attested must still fire
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "live",
        hasLiveTimelineSnapshot: true,
      }),
      RISK,
      FRESH_PROOF_OVERVIEW,
    );
    expect(page.proofFresh).toBe(true);
    expect(page.hasLiveKpis).toBe(true);
  });

  it("attested snapshot context with recent proof rows preserves proofFresh=true", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "attested",
        hasLiveTimelineSnapshot: true,
      }),
      RISK,
      FRESH_PROOF_OVERVIEW,
    );
    expect(page.proofFresh).toBe(true);
  });
});

describe("seed honesty gate", () => {
  it("daily-seed snapshot does not activate hasLiveKpis", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "daily-seed",
        hasLiveTimelineSnapshot: false,
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.hasLiveKpis).toBe(false);
  });

  it("daily-seed snapshot keeps capital provenance as manual", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "daily-seed",
        hasLiveTimelineSnapshot: false,
        vault: {
          aumUsdc: 800_000,
          delta30dUsdc: 0,
          apyRange: { low: 9.4, high: 12.8 },
          stressedApy: 5.2,
          stressedApyRange: { low: 4.4, high: 6.0 },
          riskScore: 47,
          miningMarginScore: 60,
          mode: "balanced",
          asOf: new Date("2026-06-01T00:00:00Z"),
        },
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.capitalProvenance).toBe("manual");
  });

  it("source 'live' activates hasLiveKpis", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "live",
        hasLiveTimelineSnapshot: true,
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.hasLiveKpis).toBe(true);
  });

  it("source 'oracle' activates hasLiveKpis", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "oracle",
        hasLiveTimelineSnapshot: true,
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.hasLiveKpis).toBe(true);
  });

  it("source 'attested' activates hasLiveKpis", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: true,
        latestSnapshotSource: "attested",
        hasLiveTimelineSnapshot: true,
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.hasLiveKpis).toBe(true);
  });

  it("null snapshot source is conservative (non-live)", () => {
    const page = resolveDashboardPageInputs(
      makeData({
        hasTimelineSnapshot: false,
        latestSnapshotSource: null,
        hasLiveTimelineSnapshot: false,
      }),
      RISK,
      OVERVIEW,
    );
    expect(page.hasLiveKpis).toBe(false);
  });
});

describe("isLiveTimelineSource", () => {
  it("returns false for daily-seed", () => {
    expect(isLiveTimelineSource("daily-seed")).toBe(false);
  });

  it("returns true for live / oracle / attested", () => {
    expect(isLiveTimelineSource("live")).toBe(true);
    expect(isLiveTimelineSource("oracle")).toBe(true);
    expect(isLiveTimelineSource("attested")).toBe(true);
  });

  it("returns false for null / undefined / unknown string", () => {
    expect(isLiveTimelineSource(null)).toBe(false);
    expect(isLiveTimelineSource(undefined)).toBe(false);
    expect(isLiveTimelineSource("computed")).toBe(false);
  });
});
