/**
 * DashboardAssetsBoard — Admin command-center layout contract.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { OverviewClusters } from "@/lib/data/overview-clusters";
import type { PlatformTotals } from "@/lib/data/platform-totals";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

const PLATFORM_TOTALS: PlatformTotals = {
  investorCount: 0,
  investedCapitalUsdc: 0,
};

const OVERVIEW_CLUSTERS: OverviewClusters = {
  totalCapacityUsdc: 0,
  pipelineCount: 0,
  kycApproved: 0,
  kycPending: 0,
  governance: { signing: 0, timelock: 0, executable: 0 },
  distributedTotalUsdc: 0,
  distributionsCount: 0,
};

const RISK: RiskFrameworkData = {
  composite: 47,
  band: "medium",
  bandLabel: "Medium",
  dimensions: [
    { id: "market", label: "Market", score: 50, severity: "medium" },
    { id: "mining", label: "Mining", score: 40, severity: "low" },
    { id: "liquidity", label: "Liquidity", score: 45, severity: "low" },
    { id: "smart_contract", label: "Smart contract", score: 30, severity: "low" },
    { id: "counterparty", label: "Counterparty", score: 55, severity: "medium" },
  ] as RiskFrameworkData["dimensions"],
  source: "db",
};

const PROOF: AdminProofStatus = {
  lastMiningAttestationAt: null,
  miningFreshness: "stale",
  attestationsCount: 0,
  proofsTotal: 0,
  custodyConfigured: false,
  custodyProvenance: "manual",
  custodyReservesUsdc: 0,
};

const COCKPIT: CockpitPayload = {
  actionQueue: [],
  vaultMetrics: [],
  inngestJobs: [],
  sentryStats: { errors24h: 0, warnings24h: 0 },
  onChainEvents: [],
  auditTrail: [],
};

const ALLOCATIONS: DashboardData["allocations"] = [
  { bucket: "mining", pct: 40, valueUsdc: 0, yieldContributionBps: 0 },
  { bucket: "usdc_base", pct: 60, valueUsdc: 0, yieldContributionBps: 0 },
];

function makeData(overrides: Partial<DashboardData>): DashboardData {
  const base: DashboardData = {
    vault: {
      aumUsdc: 0,
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
    allocations: ALLOCATIONS,
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
    latestDistribution: {
      period: "2026-05",
      amount_usdc: 0,
      paid_at: null,
      status: "pending",
      synthesized: true,
    },
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
    source: "fallback",
    hasTimelineSnapshot: false,
    latestSnapshotSource: null,
    hasLiveTimelineSnapshot: false,
  };
  return { ...base, ...overrides };
}

function render(
  data: DashboardData,
  capitalUsdc: number,
  proof: AdminProofStatus = PROOF,
  hasLiveKpis = false,
  cockpit: CockpitPayload = COCKPIT,
) {
  return renderToStaticMarkup(
    <DashboardAssetsBoard
      data={data}
      risk={RISK}
      proof={proof}
      capitalUsdc={capitalUsdc}
      headlineApy={null}
      yieldPosture="awaiting first snapshot"
      hasLiveKpis={hasLiveKpis}
      proofFresh={false}
      cockpit={cockpit}
      platformTotals={PLATFORM_TOTALS}
      overviewClusters={OVERVIEW_CLUSTERS}
    />,
  );
}

function makeLiveData(overrides: Partial<DashboardData> = {}): DashboardData {
  return makeData({
    source: "db",
    hasTimelineSnapshot: true,
    latestSnapshotSource: "live",
    hasLiveTimelineSnapshot: true,
    allocations: [
      { bucket: "mining", pct: 40, valueUsdc: 200_000, yieldContributionBps: 0 },
      { bucket: "usdc_base", pct: 60, valueUsdc: 300_000, yieldContributionBps: 0 },
    ],
    timeseries: {
      source: "db",
      nav30d: [
        { date: "2026-05-01", aum_usdc: 400_000 },
        { date: "2026-05-15", aum_usdc: 500_000 },
      ],
      apy30d: [],
    },
    ...overrides,
  });
}

describe("DashboardAssetsBoard — command-center layout", () => {
  it("roots the board and mounts the System readiness operator header", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    // Bento rebuild: the legacy `.dashboard-cockpit` grid root was retired. The
    // board now opens with a vertical bento stack whose first module is the
    // full-width System readiness header — that semantic anchor (not a CSS grid
    // class) is the contract that the board mounted its top-level surface.
    expect(html).toContain('class="flex flex-col gap-5"');
    expect(html).toContain('aria-label="System readiness"');
  });

  it("does not duplicate KPI rows in a secondary vitals column", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).not.toContain("dashboard-vitals-hero__stats");
    expect(html).not.toContain("dashboard-vitals-stat-row");
  });

  it("renders the platform overview band (4 clusters + caption) above the vault strip", () => {
    const html = render(makeData({ source: "fallback" }), 0);

    // Bento rebuild: the legacy `.dashboard-cockpit-row--overview` /
    // `.dashboard-overview-surface` grid is gone; the band is now a flat Tailwind
    // grid anchored by the stable `aria-label="Platform overview"` semantic.
    expect(html).toContain('aria-label="Platform overview"');
    expect(html).toContain("Platform · all vaults");
    // The four cluster labels.
    expect(html).toContain(">Capital<");
    expect(html).toContain(">Clients<");
    expect(html).toContain(">Governance<");
    expect(html).toContain(">Exposure<");
    // Band sits before the vault KPI strip (executive position).
    const overview = html.indexOf('aria-label="Platform overview"');
    const kpis = html.indexOf('aria-label="Vault KPIs"');
    expect(overview).toBeGreaterThan(-1);
    expect(kpis).toBeGreaterThan(overview);
  });

  it("overview band no longer duplicates Invested capital / Investors in the vault strip", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    // Platform totals live ONLY in the band now, not the vault strip.
    expect(html).not.toContain(">Invested capital<");
    expect(html).not.toContain(">Investors<");
    expect(html).toContain(">Total AUM<");
    expect(html).toContain(">Total investors<");
  });

  it("prioritizes KPI strip, cockpit ops row, then lower row (risk + audit)", () => {
    // No-live-kpis path: KPI card → awaiting placeholder → ops row → lower row.
    // Bento rebuild: ordering is now asserted on stable semantic anchors instead
    // of the retired `.dashboard-cockpit-row--*` grid classes —
    //   awaiting  = the "Vault analytics awaiting live data" placeholder section
    //   ops row   = the Operator-queue/Vault-health/Platform-status trio panel
    //               (anchored on the unique ">Vault health<" pane title)
    //   lower row = the Risk-posture/Audit-trail panel (anchored on ">Audit trail<")
    const html = render(makeData({ source: "fallback" }), 0);

    const kpis = html.indexOf('aria-label="Vault KPIs"');
    const awaiting = html.indexOf('aria-label="Vault analytics awaiting live data"');
    const cockpitOps = html.indexOf(">Vault health<");
    const activity = html.indexOf(">Audit trail<");

    expect(kpis).toBeGreaterThan(-1);
    expect(awaiting).toBeGreaterThan(kpis);
    expect(cockpitOps).toBeGreaterThan(awaiting);
    expect(activity).toBeGreaterThan(cockpitOps);
  });

  it("live-kpis path: vault charts render before ops row", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeLiveData()}
        risk={RISK}
        proof={PROOF}
        capitalUsdc={500_000}
        headlineApy={{ low: 9.4, high: 12.8 }}
        yieldPosture="within target band"
        hasLiveKpis
        proofFresh={false}
        cockpit={COCKPIT}
        platformTotals={PLATFORM_TOTALS}
        overviewClusters={OVERVIEW_CLUSTERS}
      />,
    );

    // Bento rebuild ordering anchors (live path):
    //   vaultSignal = the live charts hero (allocation orbit), anchored on the
    //                 unique "Vault allocation map" section that only renders
    //                 when vault analytics are live — replaces the retired
    //                 `.dashboard-command-row-a--hero` row class.
    //   ops / lower = same trio + risk/audit anchors as the no-live path.
    const kpis = html.indexOf('aria-label="Vault KPIs"');
    const vaultSignal = html.indexOf('aria-label="Vault allocation map"');
    const cockpitOps = html.indexOf(">Vault health<");
    const activity = html.indexOf(">Audit trail<");

    expect(kpis).toBeGreaterThan(-1);
    expect(vaultSignal).toBeGreaterThan(kpis);
    expect(cockpitOps).toBeGreaterThan(vaultSignal);
    expect(activity).toBeGreaterThan(cockpitOps);
  });

  it("removes secondary capital, risk, distribution and proof panels from the main dashboard", () => {
    const html = render(makeData({ source: "fallback" }), 0);

    expect(html).not.toContain(">Capital stack<");
    expect(html).not.toContain(">Risk lens<");
    expect(html).not.toContain(">Proof &amp; custody<");
    // NOTE: a small `dashboard-overview-ledger__label` reading "Distribution"
    // now lives inside the Exposure cluster — that is a ledger label, not the
    // removed secondary panel. The structural guards below are what prove the
    // old panels are gone.
    expect(html).not.toContain("dashboard-command-row-b");
    expect(html).not.toContain("dashboard-assets-stack__row");
    expect(html).not.toContain("dashboard-assets-risk__row");
  });


  it("keeps proof, risk, and operator queue KPI aligned with the ActionQueue panel", () => {
    const proofWithRecords: AdminProofStatus = {
      ...PROOF,
      proofsTotal: 2,
      attestationsCount: 1,
      custodyConfigured: true,
      custodyReservesUsdc: 250_000,
      custodyProvenance: "live",
      lastMiningAttestationAt: new Date("2026-06-12T00:00:00Z"),
    };
    const html = render(makeData({ source: "fallback" }), 0, proofWithRecords);

    expect(html).not.toContain('href="/admin/proof-center"');
    expect(html).not.toContain('href="/admin/proofs"');
    expect(html).toContain('aria-label="Risk:');
    expect(html).toContain(">Proof<");
    expect(html).toContain(">Operator queue<");
    expect(html).toContain('aria-label="Operator queue: 0"');
    expect(html).toContain(">Stale<");
    expect(html).toContain("Last Jun 12");
    expect(html).toContain("All clear — no operator actions queued.");
  });

  it("operator queue KPI count matches cockpit.actionQueue length", () => {
    const html = render(
      makeData({ source: "fallback" }),
      0,
      PROOF,
      false,
      {
        ...COCKPIT,
        actionQueue: [
          {
            id: "aq-1",
            type: "oracle.stale",
            severity: "P0",
            title: "Oracle feed stale",
            context: "7h ago",
            href: "/admin/monitoring",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
          {
            id: "aq-2",
            type: "kyc.review",
            severity: "P1",
            title: "KYC review",
            context: "pending",
            href: "/admin/customers",
            createdAt: "2026-06-01T11:00:00.000Z",
          },
        ],
      },
    );

    expect(html).toContain('aria-label="Operator queue: 2"');
    expect(html).not.toContain("All clear — no operator actions queued.");
    expect(html).not.toContain('Data provenance: Live');
  });

  it("defensive pill with populated operator queue does not badge queue as Live", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeData({
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
        })}
        risk={RISK}
        proof={PROOF}
        capitalUsdc={0}
        headlineApy={{ low: 6, high: 10 }}
        yieldPosture="within target band"
        hasLiveKpis={false}
        proofFresh={false}
        cockpit={{
          ...COCKPIT,
          actionQueue: [
            {
              id: "aq-def-1",
              type: "oracle.stale",
              severity: "P0",
              title: "Oracle feed stale",
              context: "7h ago",
              href: "/admin/monitoring",
              createdAt: "2026-06-01T12:00:00.000Z",
            },
          ],
        }}
        platformTotals={PLATFORM_TOTALS}
        overviewClusters={OVERVIEW_CLUSTERS}
      />,
    );

    expect(html).toContain('aria-label="Operator queue: 1"');
    expect(html).not.toContain('Data provenance: Live');
    expect(html).toContain('Data provenance: Manual');
  });

  it("renders empty cockpit modules honestly: queue, metrics, audit all show empty state", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    // Bento rebuild: the ops trio is anchored on its unique ">Vault health<"
    // pane title instead of the retired `.dashboard-cockpit-row--ops` class.
    const cockpitOps = html.indexOf(">Vault health<");

    expect(cockpitOps).toBeGreaterThan(-1);
    // No-live-kpis: the "awaiting live data" placeholder section renders, and the
    // live charts hero (allocation orbit) does NOT — no fake live analytics.
    expect(html).toContain('aria-label="Vault analytics awaiting live data"');
    expect(html).not.toContain('aria-label="Vault allocation map"');
    // Each ops panel shows honest empty state.
    expect(html).toContain("All clear — no operator actions queued.");
    expect(html).toContain("No vault telemetry yet.");
    expect(html).toContain("No admin activity recorded yet.");
  });


  it("scopes vault health to the active fixture pill", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeData({
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
        })}
        risk={RISK}
        proof={PROOF}
        capitalUsdc={0}
        headlineApy={{ low: 6, high: 10 }}
        yieldPosture="within target band"
        hasLiveKpis={false}
        proofFresh={false}
        cockpit={{
          ...COCKPIT,
          vaultMetrics: [
            {
              vaultId: "yield",
              vaultName: "Hearst Yield Vault",
              href: "/admin/dashboard",
              status: "active",
              tvlUsdc: 500_000,
              miningMarginScore: 60,
              riskScore: 47,
              oracleDelayMs: 120_000,
              btcPosture: "neutral",
              hasTimelineData: true,
            },
            {
              vaultId: "defensive",
              vaultName: "Hearst Defensive Vault",
              href: "/admin/dashboard?vault=defensive",
              status: "live",
              tvlUsdc: 0,
              miningMarginScore: 0,
              riskScore: 0,
              oracleDelayMs: 120_000,
              btcPosture: "neutral",
              hasTimelineData: false,
            },
          ],
        }}
        platformTotals={PLATFORM_TOTALS}
        overviewClusters={OVERVIEW_CLUSTERS}
      />,
    );

    expect(html).toContain('aria-label="Vault Hearst Defensive Vault metrics"');
    expect(html).not.toContain('aria-label="Vault Hearst Yield Vault metrics"');
    expect(html).toContain("No telemetry");
  });

  it("readiness: dot-strip replaces the matrix; verdict posture applied; no fake freshness stat", () => {
    // Bento rebuild: SystemReadinessModule was re-skinned to a BentoPanel, so the
    // `.dashboard-readiness__*` class hooks are gone. The same contract is now
    // asserted on stable semantic anchors:
    //   verdict   = the BentoPanel carries `data-posture`, with the dominant
    //               18px postureLabel + the "System readiness" header.
    //   dot-strip = the factor dots live in a `aria-label="Readiness factors"` list.
    // The honesty / anti-duplication guards below keep matching by string and
    // stay verbatim — they prove the old matrix + fake freshness stat never
    // return and the verdict blurb never duplicates the queue-count mention.
    const html = render(makeData({ source: "fallback" }), 0);

    // Verdict element present (dominant posture on the readiness panel header).
    expect(html).toContain("data-posture=");
    expect(html).toContain('aria-label="System readiness"');
    // Compact dot-strip present (terse factor list, not the 5-row matrix).
    expect(html).toContain('aria-label="Readiness factors"');
    // Old matrix structure absent (the retired matrix hooks must not come back).
    expect(html).not.toContain("dashboard-readiness__matrix");
    expect(html).not.toContain("dashboard-readiness__factor-label");
    // Fake freshness stat absent (honesty: no invented "last synced" copy).
    expect(html).not.toContain("Synced moments ago");
    expect(html).not.toContain("Last system check");
    // Blurb does not duplicate queue count mention (queue lives only in KPI strip).
    expect(html).not.toContain("Operator action required before readiness clears.");
  });

  it("renders live vault signal and populated cockpit modules without restoring removed panels", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeLiveData()}
        risk={RISK}
        proof={PROOF}
        capitalUsdc={500_000}
        headlineApy={{ low: 9.4, high: 12.8 }}
        yieldPosture="within target band"
        hasLiveKpis
        proofFresh={false}
        cockpit={{
          ...COCKPIT,
          actionQueue: [
            {
              id: "aq-1",
              type: "memo.publish",
              severity: "P2",
              title: "Publish memo",
              context: "Q2 draft ready",
              href: "/admin/memos",
              createdAt: "2026-06-01T12:00:00.000Z",
            },
          ],
          vaultMetrics: [
            {
              vaultId: "yield",
              vaultName: "Hearst Yield Vault",
              href: "/admin/vaults/yield",
              status: "active",
              tvlUsdc: 500_000,
              miningMarginScore: 60,
              riskScore: 47,
              oracleDelayMs: 120_000,
              btcPosture: "neutral",
              hasTimelineData: true,
            },
          ],
          inngestJobs: [
            {
              id: "job-1",
              name: "sync-oracle",
              status: "ok",
            },
          ],
          auditTrail: [
            {
              id: "audit-1",
              occurredAt: "2026-06-01T12:00:00.000Z",
              actorWallet: "0x1234567890123456789012345678901234567890",
              action: "vault.update",
              entityType: "Vault",
              entityId: "yield",
            },
          ],
        }}
        platformTotals={PLATFORM_TOTALS}
        overviewClusters={OVERVIEW_CLUSTERS}
      />,
    );

    expect(html).toContain('aria-label="Operator queue: 1"');
    expect(html).toContain(">Operator queue<");
    expect(html).toContain(">Vault health<");
    expect(html).toContain(">Platform status<");
    // Audit trail lives in the lower row (Row 3) — the Risk-posture/Audit-trail
    // panel. Bento rebuild: the `.dashboard-cockpit-row--lower` grid class is
    // gone, so the contract is the order (ops trio → risk posture → audit trail).
    expect(html).toContain(">Audit trail<");
    expect(html.indexOf(">Vault health<")).toBeGreaterThan(-1);
    expect(html.indexOf(">Risk posture<")).toBeGreaterThan(html.indexOf(">Vault health<"));
    expect(html.indexOf(">Audit trail<")).toBeGreaterThan(html.indexOf(">Risk posture<"));
    expect(html).toContain("dashboard-orbit__svg");
    // The "% mapped" gauge is now split into two typography-tokenized spans
    // (`<value>%` + `Mapped`) inside the orbit core meta row.
    expect(html).toContain("dashboard-orbit__core-meta");
    expect(html).toContain(">Mapped<");
    expect(html).toContain("dashboard-nav-bars__bar");
    // Dashboard now uses a compact risk card instead of the broken waterfall SVG.
    expect(html).not.toContain("ct-waterfall-svg");
    expect(html).toContain(">Risk posture<");
    expect(html).toContain(">Medium<");
    expect(html).not.toContain(">Capital stack<");
    expect(html).not.toContain(">Risk lens<");
  });

  it("seed preview shows charts and simulated badge without live KPIs", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeData({
          source: "partial",
          hasTimelineSnapshot: true,
          latestSnapshotSource: "daily-seed",
          hasLiveTimelineSnapshot: false,
          allocations: [
            { bucket: "mining", pct: 40, valueUsdc: 200_000, yieldContributionBps: 0 },
            { bucket: "usdc_base", pct: 60, valueUsdc: 300_000, yieldContributionBps: 0 },
          ],
          timeseries: {
            source: "db",
            nav30d: [
              { date: "2026-05-01", aum_usdc: 400_000 },
              { date: "2026-05-15", aum_usdc: 500_000 },
            ],
            apy30d: [],
          },
          recentEvents: [
            {
              id: "ev-1",
              ruleId: "rebalance-1",
              takenAt: new Date("2026-06-01T00:00:00Z"),
              triggerText: "Margin compressing",
              actionText: "Reduce BTC sleeve",
              impactText: "Target allocation restored",
            },
          ],
        })}
        risk={RISK}
        proof={PROOF}
        capitalUsdc={500_000}
        headlineApy={{ low: 9.4, high: 12.8 }}
        yieldPosture="within target band"
        hasLiveKpis={false}
        hasSeedPreview
        showVaultAnalytics
        proofFresh={false}
        cockpit={COCKPIT}
        platformTotals={PLATFORM_TOTALS}
        overviewClusters={OVERVIEW_CLUSTERS}
      />,
    );

    expect(html).toContain("dashboard-orbit__svg");
    expect(html).toContain("Seed snapshot — simulated preview");
    expect(html).toContain('Data provenance: Simulated');
    expect(html).not.toContain('Data provenance: Live');
    expect(html).toContain('aria-label="Recent vault activity"');
    expect(html).toContain("Reduce BTC sleeve");
  });
});
