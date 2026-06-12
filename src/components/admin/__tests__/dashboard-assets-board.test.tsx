/**
 * DashboardAssetsBoard — Admin Honesty contract.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardAssetsBoard } from "@/components/admin/dashboard-assets-board";
import type { AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
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

const ACTIONS: AdminActionItem[] = [
  {
    key: "deployments" as AdminActionItem["key"],
    label: "Deployments",
    count: 0,
    href: null,
    tracked: false,
    hint: "",
  },
];

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
  };
  return { ...base, ...overrides };
}

function allocationCard(html: string): string {
  const marker = "Capital stack appears once";
  const start = html.indexOf(marker);
  if (start === -1) return html;
  const rest = html.slice(start - 200);
  const end = rest.indexOf("Risk lens");
  return end === -1 ? rest : rest.slice(0, end);
}

function render(
  data: DashboardData,
  capitalUsdc: number,
  proof: AdminProofStatus = PROOF,
) {
  return renderToStaticMarkup(
    <DashboardAssetsBoard
      data={data}
      risk={RISK}
      proof={proof}
      actions={ACTIONS}
      totalActionRequired={0}
      capitalUsdc={capitalUsdc}
      capitalProvenance="estimated"
      headlineApy={null}
      yieldPosture="awaiting first snapshot"
      hasLiveKpis={false}
      proofFresh={false}
      cockpit={COCKPIT}
    />,
  );
}

describe("DashboardAssetsBoard — Admin Honesty", () => {
  it("fallback source + $0 AUM does NOT render a live CSS orbit ring", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).toContain("dashboard-orbit-empty");
    expect(html).not.toContain("dashboard-orbit__ring");
    expect(html).not.toContain("% mapped");
  });

  it("fallback source does NOT badge the capital stack as Live", () => {
    const card = allocationCard(render(makeData({ source: "fallback" }), 0));
    expect(card).not.toContain(">Live<");
    expect(card).not.toContain(">Capital stack<");
    expect(card).toContain("Capital stack appears once the first snapshot");
  });

  it("no NAV series → no '+0.0% NAV', shows pending instead", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).not.toContain("% NAV");
    expect(html).toContain("NAV trend appears after seven days");
    expect(html).not.toContain("NAV trend pending");
    expect(html).not.toContain("dashboard-nav-bars__bar");
  });

  it("db source WITH capital renders the live orbit + capital stack", () => {
    const data = makeData({
      source: "db",
      hasTimelineSnapshot: true,
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
    });
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={data}
        risk={RISK}
        proof={PROOF}
        actions={ACTIONS}
        totalActionRequired={0}
        capitalUsdc={500_000}
        capitalProvenance="live"
        headlineApy={{ low: 9.4, high: 12.8 }}
        yieldPosture="within target band"
        hasLiveKpis
        proofFresh={false}
        cockpit={COCKPIT}
      />,
    );
    expect(html).toContain("dashboard-orbit__ring");
    expect(html).toContain("% mapped");
    expect(html).toContain("dashboard-nav-bars__bar");
    const card = allocationCard(html);
    expect(card).toContain(">Capital stack<");
    expect(card).toContain(">Live<");
    expect(card).not.toContain("Capital stack appears once the first snapshot");
  });

  it("renders wired admin routes for proof and distributions", () => {
    const proofWithRecords: AdminProofStatus = {
      ...PROOF,
      proofsTotal: 2,
      attestationsCount: 1,
      custodyConfigured: true,
      custodyReservesUsdc: 250_000,
      custodyProvenance: "live",
    };
    const html = render(makeData({ source: "fallback" }), 0, proofWithRecords);
    expect(html).toContain('href="/admin/proof-center"');
    expect(html).toContain('href="/admin/proofs"');
    expect(html).toContain('href="/admin/distributions"');
  });

  it("empty proof slot uses chart placeholder, not active proof panel", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).toContain("Proof and custody records appear after");
    expect(html).not.toContain('href="/admin/proof-center"');
  });

  it("empty cockpit modules use EmptySurface, not panel shells (DS §9)", () => {
    const html = render(makeData({ source: "fallback" }), 0);
    expect(html).toContain("All clear — no pending actions.");
    expect(html).toContain("No vault telemetry yet.");
    expect(html).toContain("No admin activity recorded yet.");
    expect(html).not.toContain(">Action Queue<");
    expect(html).not.toContain(">Live Metrics<");
    expect(html).not.toContain(">Recent admin activity<");
  });

  it("live command board renders populated cockpit modules", () => {
    const html = renderToStaticMarkup(
      <DashboardAssetsBoard
        data={makeData({
          source: "db",
          hasTimelineSnapshot: true,
          allocations: [
            { bucket: "mining", pct: 40, valueUsdc: 200_000, yieldContributionBps: 0 },
            { bucket: "usdc_base", pct: 60, valueUsdc: 300_000, yieldContributionBps: 0 },
          ],
        })}
        risk={RISK}
        proof={PROOF}
        actions={ACTIONS}
        totalActionRequired={0}
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
    expect(html).toContain(">Action queue<");
    expect(html).toContain(">Live metrics<");
    expect(html).toContain(">Recent admin activity<");
  });
});
