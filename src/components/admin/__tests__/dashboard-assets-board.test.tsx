/**
 * DashboardAssetsBoard — Admin command-center layout contract.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardAssetsBoard } from "@/components/admin/dashboard";
import type { AdminProofStatus } from "@/lib/data/admin-overview";
import type { CockpitPayload } from "@/lib/data/cockpit";
import type { DashboardData } from "@/lib/data/dashboard";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

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
) {
  return renderToStaticMarkup(
    <DashboardAssetsBoard
      data={data}
      risk={RISK}
      proof={proof}
      totalActionRequired={2}
      capitalUsdc={capitalUsdc}
      capitalProvenance="estimated"
      headlineApy={null}
      yieldPosture="awaiting first snapshot"
      hasLiveKpis={hasLiveKpis}
      proofFresh={false}
      cockpit={COCKPIT}
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
  it("roots the board in dashboard-command-board for dash-board container queries", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).toContain("dashboard-command-board");
  });

  it("does not duplicate KPI rows in a secondary vitals column", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).not.toContain("dashboard-vitals-hero__stats");
    expect(html).not.toContain("dashboard-vitals-stat-row");
  });

  it("prioritizes KPI strip, vault signal charts, cockpit operations, then audit trail", () => {
    const html = render(makeData({ source: "fallback" }), 0);

    const kpis = html.indexOf('aria-label="Vault KPIs"');
    const vaultSignal = html.indexOf("dashboard-command-row-a");
    const cockpitOps = html.indexOf('aria-label="Cockpit operations"');
    const activity = html.indexOf('aria-label="Recent admin activity"');

    expect(kpis).toBeGreaterThan(-1);
    expect(vaultSignal).toBeGreaterThan(kpis);
    expect(cockpitOps).toBeGreaterThan(vaultSignal);
    expect(activity).toBeGreaterThan(cockpitOps);
  });

  it("removes secondary capital, risk, distribution and proof panels from the main dashboard", () => {
    const html = render(makeData({ source: "fallback" }), 0);

    expect(html).not.toContain(">Capital stack<");
    expect(html).not.toContain(">Risk lens<");
    expect(html).not.toContain(">Distribution<");
    expect(html).not.toContain(">Proof &amp; custody<");
    expect(html).not.toContain("dashboard-command-row-b");
    expect(html).not.toContain("dashboard-assets-stack__row");
    expect(html).not.toContain("dashboard-assets-risk__row");
  });


  it("keeps proof and admin queue information in the KPI strip; risk is surfaced only in the vault ring", () => {
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
    // Risk is now carried exclusively by the VaultVitalsRing caption — not as a KPI strip cell.
    expect(html).not.toContain('aria-label="Risk:');
    expect(html).toContain(">Proof<");
    expect(html).toContain(">Admin queues<");
    expect(html).toContain(">Stale<");
    expect(html).toContain("Last Jun 12");
    expect(html).toContain(">2<");
  });

  it("renders empty cockpit modules honestly after the vault signal section", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    const cockpitOps = html.indexOf('aria-label="Cockpit operations"');
    const vaultSignal = html.indexOf("dashboard-command-row-a");

    expect(cockpitOps).toBeGreaterThan(-1);
    expect(cockpitOps).toBeGreaterThan(vaultSignal);
    expect(html).toContain("All clear — no operator actions queued.");
    expect(html).toContain("No vault telemetry yet.");
    expect(html).toContain("No admin activity recorded yet.");
  });


  it("renders live vault signal and populated cockpit modules without restoring removed panels", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeLiveData()}
        risk={RISK}
        proof={PROOF}
        totalActionRequired={2}
        capitalUsdc={500_000}
        capitalProvenance="live"
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
              lastRunAt: "2026-06-01T12:00:00.000Z",
              errorMsg: null,
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
      />,
    );

    expect(html).toContain(">Operator queue<");
    expect(html).toContain(">Vault health<");
    expect(html).toContain(">Platform status<");
    expect(html).toContain('aria-label="Recent admin activity"');
    expect(html).toContain("dashboard-orbit__svg");
    expect(html).toContain("% mapped");
    expect(html).toContain("dashboard-nav-bars__bar");
    // Waterfall risk zone is now rendered below ops (full-width)
    expect(html).toContain("ct-waterfall-svg");
    // The composite header is suppressed in the risk zone (surfaced in the hero ring instead)
    expect(html).not.toContain('stat-label">Composite');
    expect(html).toContain(">Risk Framework<");
    expect(html).not.toContain(">Capital stack<");
    expect(html).not.toContain(">Risk lens<");
  });
});
