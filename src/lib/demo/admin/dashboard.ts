// Demo admin dashboard builder.
//
// Called by `loadDashboardData` when `canRunDemoProvider()` is true
// (DEMO_PROVIDER_ENABLED=1 in a non-production environment). All data is
// simulated / synthesised — no DB, no fetch, no I/O.
//
// Non-negotiables honoured here:
//   #1  APY always as a range.
//   #2  Every metric conveys simulated provenance via per-field flags
//       (is_fallback / stale / synthesized). The top-level source is "db"
//       so live-render gates (allocationLive, navLive) fire correctly.
//   #5  Forbidden words absent.
//   #10 Assumptions and "not guaranteed" disclaimer included.

import type {
  DashboardData,
  DashboardVault,
  DashboardVaultMeta,
  DashboardAllocation,
  DashboardRecentEvent,
  DashboardTimeseries,
  NavPoint,
  ApyPoint,
} from "@/lib/data/dashboard";
import type { MiningOpsSnapshot } from "@/lib/agents/loaders/mining";
import type { DistributionSnapshot } from "@/lib/agents/loaders/distribution";
import type { VaultMonthlyRow } from "@/lib/agents/loaders/vault";
import type { BtcPriceData } from "@/lib/data/btc-price";

// ---------------------------------------------------------------------------
// Constants — internally consistent demo numbers
// ---------------------------------------------------------------------------

/** Simulated AUM for demo mode. */
const DEMO_AUM_USDC = 25_000_000;

/** 30-day growth delta shown in the hero strip. */
const DEMO_DELTA_30D_USDC = 280_000;

/** Demo APY band (methodology #1 — always a range). */
const DEMO_APY_LOW = 9.4;
const DEMO_APY_HIGH = 12.8;

/** Stressed APY band (±15% around bear projection at 65% of mid). */
const DEMO_STRESSED_APY = 7.1;
const DEMO_STRESSED_APY_LOW = 6.0;
const DEMO_STRESSED_APY_HIGH = 8.2;

const DEMO_RISK_SCORE = 38;
const DEMO_MINING_MARGIN_SCORE = 64;

/** Anchor date for the synthetic 30-day timeseries (today - 30 days). */
function demoBaseDate(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

/** Render "YYYY-MM" for a given Date. */
function periodOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Sub-builders
// ---------------------------------------------------------------------------

function buildDemoVault(): DashboardVault {
  return {
    aumUsdc: DEMO_AUM_USDC,
    delta30dUsdc: DEMO_DELTA_30D_USDC,
    apyRange: { low: DEMO_APY_LOW, high: DEMO_APY_HIGH },
    stressedApy: DEMO_STRESSED_APY,
    stressedApyRange: { low: DEMO_STRESSED_APY_LOW, high: DEMO_STRESSED_APY_HIGH },
    riskScore: DEMO_RISK_SCORE,
    miningMarginScore: DEMO_MINING_MARGIN_SCORE,
    mode: "balanced",
    asOf: new Date(),
  };
}

function buildDemoVaultMeta(vaultId: string): DashboardVaultMeta {
  return {
    id: vaultId,
    name: "Hearst Yield Vault",
    apyTarget: { low: DEMO_APY_LOW, high: DEMO_APY_HIGH },
    allocationTargets: {
      mining: 60,
      btc_tactical: 25,
      usdc_base: 10,
      stable_reserve: 5,
    },
    assumptions: [
      "Simulated data — not live. For demo purposes only.",
      "Balanced sleeve mix; mining is the dominant yield source.",
      "Monthly USDC distributions, 60-day soft lock-up (class A).",
      "Outputs are projections, not guaranteed. Past performance does not predict future results.",
    ],
    livePreview: false,
  };
}

function buildDemoAllocations(): DashboardAllocation[] {
  // Percentages sum to 100; values are proportional to DEMO_AUM_USDC.
  const buckets: Array<{
    bucket: DashboardAllocation["bucket"];
    pct: number;
    yieldContributionBps: number;
  }> = [
    { bucket: "mining", pct: 60, yieldContributionBps: 720 },
    { bucket: "btc_tactical", pct: 25, yieldContributionBps: 280 },
    { bucket: "usdc_base", pct: 10, yieldContributionBps: 40 },
    { bucket: "stable_reserve", pct: 5, yieldContributionBps: 15 },
  ];

  return buckets.map(({ bucket, pct, yieldContributionBps }) => ({
    bucket,
    pct,
    valueUsdc: Math.round(DEMO_AUM_USDC * (pct / 100)),
    yieldContributionBps,
  }));
}

function buildDemoMiningOps(): MiningOpsSnapshot {
  return {
    hashrate_ph_s: 2.4,
    uptime_pct: 97.3,
    margin_score: DEMO_MINING_MARGIN_SCORE,
    attestations_count: 12,
    hashprice: null,
    is_fallback: true, // simulated — badge as estimated per B3
  };
}

function buildDemoLatestDistribution(): DistributionSnapshot {
  const now = new Date();
  const period = periodOf(new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    period,
    amount_usdc: 148_000,
    paid_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    status: "paid",
    synthesized: true,
  };
}

function buildDemoMonthlyHistory(): VaultMonthlyRow[] {
  const now = new Date();
  const rows: VaultMonthlyRow[] = [];
  // 4 months, oldest-first, anchored on DEMO_AUM_USDC.
  for (let i = 3; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const driftFactor = 1 - i * 0.008;
    const nav = Math.round(DEMO_AUM_USDC * driftFactor);
    const dist = Math.round(nav * 0.008);
    const prevNav = i < 3 ? Math.round(DEMO_AUM_USDC * (1 - (i + 1) * 0.008)) : 0;
    const apyAchieved =
      prevNav > 0
        ? Math.round(((nav - prevNav + dist) / prevNav) * 12 * 100 * 10) / 10
        : (DEMO_APY_LOW + DEMO_APY_HIGH) / 2;
    rows.push({
      period: periodOf(date),
      apy_low: DEMO_APY_LOW,
      apy_high: DEMO_APY_HIGH,
      apy_achieved: apyAchieved,
      nav_usdc: nav,
      distribution_usdc: dist,
    });
  }
  return rows;
}

function buildDemoBtcPrice(): BtcPriceData {
  return {
    usd: 97_200,
    usd_24h_change: 1.4,
    fetched_at: new Date(),
    stale: true, // simulated — not a live fetch
    provenance: "stale",
  };
}

function buildDemoRecentEvents(): DashboardRecentEvent[] {
  const base = new Date();
  return [
    {
      id: "demo-evt-1",
      ruleId: "RULE-BTC-MOMENTUM-UP",
      takenAt: new Date(base.getTime() - 3 * 24 * 60 * 60 * 1000),
      triggerText: "BTC momentum +12% over 7 days exceeded rebalance threshold.",
      actionText: "Shift 5% from usdc_base to btc_tactical sleeve.",
      impactText: "Projected APY range lifted by +0.3–0.6 pp.",
    },
    {
      id: "demo-evt-2",
      ruleId: "RULE-MINING-MARGIN-COMPRESS",
      takenAt: new Date(base.getTime() - 10 * 24 * 60 * 60 * 1000),
      triggerText: "Mining margin score dropped below 60 for 3 consecutive days.",
      actionText: "Trim mining sleeve by 3%, redirect to stable_reserve.",
      impactText: "Stress-scenario APY floor protected; margin score recovered to 64.",
    },
  ];
}

function buildDemoTimeseries(): DashboardTimeseries {
  const base = demoBaseDate();
  const nav30d: NavPoint[] = [];
  const apy30d: ApyPoint[] = [];

  for (let day = 0; day <= 30; day += 1) {
    const d = addDays(base, day);
    // Smooth upward drift: +1.1% over 30 days, small daily noise via sine.
    const drift = 1 + (day / 30) * 0.011;
    const noise = Math.sin(day * 1.3) * 0.0008;
    const aum = Math.round(DEMO_AUM_USDC * (drift + noise));

    // APY range oscillates gently ±0.3 pp around the target mid.
    const apyNoise = Math.sin(day * 0.7) * 0.3;
    const apyLow = Math.round((DEMO_APY_LOW + apyNoise) * 10) / 10;
    const apyHigh = Math.round((DEMO_APY_HIGH + apyNoise) * 10) / 10;

    nav30d.push({ date: toIsoDate(d), aum_usdc: aum });
    apy30d.push({ date: toIsoDate(d), apy_low: apyLow, apy_high: apyHigh });
  }

  return { nav30d, apy30d, source: "db" };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Builds a fully-typed, internally consistent `DashboardData` backed entirely
 * by simulated numbers. Never touches the DB or any external API.
 *
 * Gate: called only when `canRunDemoProvider()` is true. The caller
 * (`loadDashboardData`) is responsible for the guard — this function is pure.
 */
export function buildDemoDashboardData(vaultId?: string): DashboardData {
  const resolvedId = vaultId ?? "yield";

  return {
    vault: buildDemoVault(),
    vaultMeta: buildDemoVaultMeta(resolvedId),
    allocations: buildDemoAllocations(),
    miningOps: buildDemoMiningOps(),
    hashpriceTrendPct: -2.1,
    operationalConfidence: 78,
    latestDistribution: buildDemoLatestDistribution(),
    monthlyHistory: buildDemoMonthlyHistory(),
    btcPrice: buildDemoBtcPrice(),
    recentEvents: buildDemoRecentEvents(),
    timeseries: buildDemoTimeseries(),
    // "db" enables allocationLive + navLive rendering (orbit + NAV chart).
    // Provenance/badge fields remain honest (simulated/estimated).
    source: "db",
    hasTimelineSnapshot: false,
    latestSnapshotSource: null,
    hasLiveTimelineSnapshot: false,
    // Signal to downstream resolvers: KPIs fill with demo values, badges read
    // "simulated" — never "live" or "attested".
    simulated: true,
  };
}
