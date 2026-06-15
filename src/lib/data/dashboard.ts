import "server-only";

import { Prisma } from "@prisma/client";

import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoDashboardData } from "@/lib/demo/admin/dashboard";
import {
  loadLatestMiningMetrics,
  loadMiningOpsSnapshot,
  type MiningOpsSnapshot,
} from "@/lib/agents/loaders/mining";
import {
  loadLatestDistribution,
  type DistributionSnapshot,
} from "@/lib/agents/loaders/distribution";
import { loadVaultMonthlyHistory, type VaultMonthlyRow } from "@/lib/agents/loaders/vault";
import { fetchBtcPrice, type BtcPriceData } from "@/lib/data/btc-price";
import {
  isLiveTimelineSource,
  loadLatestTimelineSnapshot,
  timelineSnapshotWhere,
  type TimelineSnapshotSource,
} from "@/lib/data/timeline-snapshot";
import { prisma } from "@/lib/db";
import type { VaultMode, VaultId } from "@/lib/engine/types";
import {
  VAULTS,
  VAULT_YIELD,
  type AllocationTargets,
  type VaultDefinition,
} from "@/lib/engine/vaults";
import { METHODOLOGY_FACTORS } from "@/lib/engine/methodology";
import type { VaultRef } from "@/lib/vaults/resolver";
import { toVaultProfile } from "@/lib/vaults/profile";

// ---------------------------------------------------------------------------
// Public dashboard contract.
//
// Single shape consumed by `src/app/admin/dashboard/page.tsx`. Every field
// either comes from Prisma (`source: "db"`) or from a safe, mock-equivalent
// fallback when the DB is empty (`source: "fallback"`). The page-level
// adapter `toDashboardSnapshot` in this file projects this onto the UI
// `DashboardSnapshot` so the existing dashboard components stay untouched.
// ---------------------------------------------------------------------------

// VaultMode is canonical in `@/lib/engine/types`; re-exported here so existing
// dashboard consumers keep importing it from this module (dedup, single source).
export type { VaultMode };

export interface DashboardVault {
  aumUsdc: number;
  /** AUM delta over the past 30 days, USDC. Can be negative. */
  delta30dUsdc: number;
  apyRange: { low: number; high: number };
  /**
   * Stressed APY centre (Bear scenario, methodology v1.0).
   * @deprecated UI consumes `stressedApyRange` to comply with CLAUDE.md rule
   * #1 (APY always as range). Kept here for engine/agent loaders that already
   * read the single-point projection.
   */
  stressedApy: number;
  /**
   * Stressed APY as a range — UI surface. ±15% band around the bear scenario
   * projection (methodology v1.0 MVP proxy until per-scenario p5/p95 land).
   */
  stressedApyRange: { low: number; high: number };
  riskScore: number;
  miningMarginScore: number;
  mode: VaultMode;
  /** Snapshot timestamp the rest of the dashboard derives from. */
  asOf: Date;
}

export type DashboardAllocationBucket =
  | "mining"
  | "btc_tactical"
  | "usdc_base"
  | "stable_reserve";

export interface DashboardAllocation {
  bucket: DashboardAllocationBucket;
  pct: number;
  valueUsdc: number;
  yieldContributionBps: number;
}

export interface DashboardRecentEvent {
  id: string;
  ruleId: string;
  takenAt: Date;
  triggerText: string;
  actionText: string;
  impactText: string;
}

export interface NavPoint {
  /** ISO `YYYY-MM-DD` UTC date. */
  date: string;
  aum_usdc: number;
}

export interface ApyPoint {
  /** ISO `YYYY-MM-DD` UTC date. */
  date: string;
  apy_low: number;
  apy_high: number;
}

export interface DashboardTimeseries {
  nav30d: NavPoint[];
  apy30d: ApyPoint[];
  /** `fallback` when fewer than 7 DB rows exist in the trailing window. */
  source: "db" | "fallback";
}

/**
 * Vault metadata used by the dashboard hero — sourced from the engine
 * `VaultDefinition` for the requested `vaultId`. ADR-006 #9: every vault
 * carries its OWN apy range / allocation targets / name / disclaimers; the
 * dashboard surfaces these directly so two different vaults never silently
 * reuse each other's projections.
 */
export interface DashboardVaultMeta {
  /**
   * Vault identifier. For engine fixtures this is a `VaultId` ("yield" /
   * "defensive" / "btc-plus"). For Prisma deployments it is the lowercased
   * ticker slug (e.g. "hyv-a"). Widened to `string` so no cast is needed at
   * the assignment site and downstream consumers that do enum-style comparisons
   * against the 3 known fixture ids still work (string includes VaultId).
   */
  id: string;
  /** Human label, e.g. "Hearst Yield Vault". */
  name: string;
  /** Vault's OWN projected APY band (engine preset, never another vault's). */
  apyTarget: { low: number; high: number };
  /** Target sleeve allocation (percent, sums to ~100). */
  allocationTargets: AllocationTargets;
  /** Vault's OWN assumptions (cited on dashboard tooltips / disclaimers). */
  assumptions: string[];
  /**
   * True when the live snapshot (`vault.aumUsdc`, allocations, etc.) is the
   * Yield Vault timeline but the user requested a non-live vault. Lets the UI
   * label the live KPIs as "preview" while still showing the requested vault's
   * own metadata. Per-vault snapshots land with Phase 3 multi-vault DB schema.
   */
  livePreview: boolean;
}

export interface DashboardData {
  vault: DashboardVault;
  /** Metadata for the *selected* vault — engine-sourced, never mixed. */
  vaultMeta: DashboardVaultMeta;
  allocations: DashboardAllocation[];
  miningOps: MiningOpsSnapshot;
  /** Latest mining margin trend signal (negative = compressing). */
  hashpriceTrendPct: number;
  /** Operational confidence composite, 0-100. */
  operationalConfidence: number;
  latestDistribution: DistributionSnapshot | null;
  monthlyHistory: VaultMonthlyRow[];
  btcPrice: BtcPriceData;
  recentEvents: DashboardRecentEvent[];
  /** 30-day NAV + APY range trailing time-series for the dashboard charts. */
  timeseries: DashboardTimeseries;
  /**
   * `db` when every field above came from real rows; `partial` when at least
   * one fallback fired; `fallback` when no DB data exists yet.
   */
  source: "db" | "partial" | "fallback";
  /** True when a timeline snapshot row exists for the Yield vault series. */
  hasTimelineSnapshot: boolean;
  /**
   * The `source` field of the latest timeline snapshot, or null when none
   * exists. Consumers that need to gate Live/Attested signals (e.g. the admin
   * dashboard KPI strip) must check this via `isLiveTimelineSource()` rather
   * than relying on `hasTimelineSnapshot` alone, since `"daily-seed"` rows are
   * valid timeline data but must NOT activate production provenance badges.
   */
  latestSnapshotSource: TimelineSnapshotSource | null;
  /**
   * True only when a timeline snapshot exists AND its source is a genuine
   * production source (live / oracle / attested). Seed and staging rows are
   * excluded. Use this — not `hasTimelineSnapshot` — to gate Live KPI signals.
   */
  hasLiveTimelineSnapshot: boolean;
  /**
   * True when this payload was produced by the demo builder (no DB, no live
   * fetch). KPI cells FILL with demo values but provenance badges must read
   * "simulated" — never "live" or "attested". Absent (undefined) on real data.
   */
  simulated?: boolean;
}

// Mode vérité live: with no DB row, report honest zeros — never the old
// fabricated "paper phase" numbers (−3.4% trend / 81 confidence). A zero
// reads as "no data yet", not as a real measurement.
const FALLBACK_HASHPRICE_TREND_PCT = 0;
const FALLBACK_OPERATIONAL_CONFIDENCE = 0;

/** Milliseconds in 30 days — used for trailing-window queries. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Number of monthly history rows fetched for the charts. */
const MONTHLY_HISTORY_MONTHS = 4;

/** Minimum number of trailing snapshot rows required to build a timeseries; below this we serve a fallback. */
const TIMESERIES_MIN_ROWS = 7;

/**
 * Derives the stressed APY range from the engine's single-point projection.
 * Returns `{ low, high }` with `low <= high`. Negative centres are kept
 * negative (band widens symmetrically around the magnitude).
 */
function stressedRangeFor(centre: number): { low: number; high: number } {
  const magnitude = Math.abs(centre) * METHODOLOGY_FACTORS.STRESSED_APY_BAND;
  const low = centre - magnitude;
  const high = centre + magnitude;
  return low <= high ? { low, high } : { low: high, high: low };
}

/**
 * Resolves the requested vault id to an engine `VaultDefinition`. Unknown ids
 * fall back to YIELD with a single console warning so a typo in `?vault=` never
 * silently substitutes another vault's data. Returns the canonical id used by
 * the rest of the loader (which the UI re-anchors links against).
 */
function resolveVaultDefinition(
  requested: string | undefined,
): { def: VaultDefinition; resolvedId: VaultId; usedFallback: boolean } {
  if (requested === undefined) {
    return { def: VAULT_YIELD, resolvedId: VAULT_YIELD.id, usedFallback: false };
  }
  if (requested === "yield" || requested === "defensive" || requested === "btc-plus") {
    return { def: VAULTS[requested], resolvedId: requested, usedFallback: false };
  }
  // Unknown id — log once and fall back. We deliberately do NOT throw so a
  // bad query param never takes the dashboard down for an admin.
  console.warn(
    `[loadDashboardData] unknown vaultId="${requested}" — falling back to Yield Vault. ` +
      `Known ids: yield, defensive, btc-plus.`,
  );
  return { def: VAULT_YIELD, resolvedId: VAULT_YIELD.id, usedFallback: true };
}

/**
 * Loads everything the `/dashboard` page needs in parallel.
 *
 * Multi-vault behaviour (ADR-006 #9):
 *   - `vaultMeta` is ALWAYS derived from the engine `VaultDefinition` for the
 *     requested vault id. apy target, allocation targets, name, assumptions —
 *     these are vault-specific and never mixed across vaults.
 *   - The live snapshot fields (AUM, allocations, mining ops) are not yet
 *     scoped per vault: the DB only carries the Yield Vault timeline. When a
 *     non-yield vault is requested we therefore set `vaultMeta.livePreview =
 *     true` so the UI can label live KPIs as "Yield Vault data — preview"
 *     while still showing the requested vault's OWN metadata above the fold.
 *   - TODO (Phase 3): per-vault snapshots when the DB schema lands
 *     `VaultSnapshot.vaultDeploymentId`. Then this loader filters the snapshot
 *     query by vault and the `livePreview` flag goes away.
 *
 * Never throws on missing data: each section degrades to a fallback that
 * matches the historical mock values so the visual rendering stays stable
 * even when the DB is empty (e.g. fresh `db:push` without `db:seed`).
 */
export async function loadDashboardData(
  vaultId?: string,
): Promise<DashboardData> {
  if (canRunDemoProvider()) return buildDemoDashboardData(vaultId);

  const { def: vaultDef, resolvedId, usedFallback: vaultFallback } =
    resolveVaultDefinition(vaultId);
  const isYield = resolvedId === VAULT_YIELD.id;
  const livePreview = !isYield || vaultFallback;

  const vaultMeta: DashboardVaultMeta = {
    id: resolvedId,
    name: vaultDef.label,
    apyTarget: { low: vaultDef.apyTarget.low, high: vaultDef.apyTarget.high },
    allocationTargets: { ...vaultDef.allocationTargets },
    assumptions: [...vaultDef.assumptions],
    livePreview,
  };

  return buildDashboardFromSnapshot(vaultMeta);
}

// ---------------------------------------------------------------------------
// buildDashboardFromSnapshot — shared data-fetching core
// ---------------------------------------------------------------------------

/**
 * Private helper: fetches all DB-bound sections (snapshots, mining ops,
 * distributions, rebalance events, timeseries) and assembles a
 * {@link DashboardData} for the given `vaultMeta`.
 *
 * Both {@link loadDashboardData} and {@link loadDashboardForRef} resolve their
 * vault-specific metadata first, then delegate here. This eliminates ~120
 * lines of duplication while keeping each public function's own resolution
 * logic (fixture enum vs VaultRef/profile) cleanly separated.
 *
 * `vaultMeta.livePreview` is pre-computed by the caller; this function does
 * not touch it.
 */
async function buildDashboardFromSnapshot(
  vaultMeta: DashboardVaultMeta,
): Promise<DashboardData> {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const [
    latestSnapshot,
    miningOps,
    latestMiningRow,
    latestDistribution,
    monthlyHistory,
    btcPrice,
    rebalanceRows,
    trailingSnapshots,
  ] = await Promise.all([
    loadLatestTimelineSnapshot({ includeAllocations: true }),
    loadMiningOpsSnapshot(),
    safeLoadLatestMining(),
    loadLatestDistribution(),
    loadVaultMonthlyHistory(MONTHLY_HISTORY_MONTHS),
    fetchBtcPrice(),
    prisma.rebalanceEvent.findMany({
      orderBy: { executedAt: "desc" },
      take: 5,
    }),
    prisma.vaultSnapshot.findMany({
      where: { takenAt: { gte: thirtyDaysAgo }, ...timelineSnapshotWhere() },
      orderBy: { takenAt: "asc" },
      select: {
        takenAt: true,
        aumUsdc: true,
        currentApyLow: true,
        currentApyHigh: true,
      },
    }),
  ]);

  let usedFallback = false;

  // Decimal → number at the loader boundary: map raw Prisma rows onto the
  // number-only internal shapes before they reach the engine/UI layer.
  const mappedSnapshot = latestSnapshot
    ? toVaultSnapshotWithAllocations(latestSnapshot)
    : null;
  const mappedAllocations = (latestSnapshot?.allocations ?? []).map(toAllocationRow);
  const mappedTrailing = trailingSnapshots.map(toTrailingSnapshotRow);

  const vault = await buildVault(mappedSnapshot, vaultMeta, () => {
    usedFallback = true;
  });

  const allocations = buildAllocations(mappedAllocations, vaultMeta, () => {
    usedFallback = true;
  });

  const hashpriceTrendPct = latestMiningRow?.hashpriceTrendPct ?? FALLBACK_HASHPRICE_TREND_PCT;
  const operationalConfidence =
    latestMiningRow?.operationalConfidence ?? FALLBACK_OPERATIONAL_CONFIDENCE;
  if (latestMiningRow === null) usedFallback = true;

  const recentEvents: DashboardRecentEvent[] = rebalanceRows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    takenAt: r.executedAt,
    triggerText: r.triggerText,
    actionText: r.actionText,
    impactText: r.impactText,
  }));
  if (recentEvents.length === 0) usedFallback = true;

  const timeseries = buildTimeseries(mappedTrailing, () => {
    usedFallback = true;
  });

  const source: DashboardData["source"] =
    latestSnapshot === null || usedFallback
      ? "partial"
      : "db";

  const latestSnapshotSource =
    (latestSnapshot?.source as TimelineSnapshotSource | null | undefined) ?? null;

  return {
    vault,
    vaultMeta,
    allocations,
    miningOps,
    hashpriceTrendPct,
    operationalConfidence,
    latestDistribution,
    monthlyHistory,
    btcPrice,
    recentEvents,
    timeseries,
    source,
    hasTimelineSnapshot: latestSnapshot !== null,
    latestSnapshotSource,
    hasLiveTimelineSnapshot: isLiveTimelineSource(latestSnapshotSource),
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface VaultSnapshotWithAllocations {
  id: string;
  takenAt: Date;
  aumUsdc: number;
  currentApyLow: number;
  currentApyHigh: number;
  stressedApy: number;
  riskScore: number;
  miningMarginScore: number;
  mode: string;
}

/**
 * Maps a raw Prisma `VaultSnapshot` (Decimal financial columns) onto the
 * number-only internal `VaultSnapshotWithAllocations`. Decimal → number at the
 * data boundary so the engine/UI never sees Decimal.
 */
function toVaultSnapshotWithAllocations(row: {
  id: string;
  takenAt: Date;
  aumUsdc: Prisma.Decimal;
  currentApyLow: Prisma.Decimal;
  currentApyHigh: Prisma.Decimal;
  stressedApy: Prisma.Decimal;
  riskScore: number;
  miningMarginScore: number;
  mode: string;
}): VaultSnapshotWithAllocations {
  return {
    id: row.id,
    takenAt: row.takenAt,
    aumUsdc: row.aumUsdc.toNumber(),
    currentApyLow: row.currentApyLow.toNumber(),
    currentApyHigh: row.currentApyHigh.toNumber(),
    stressedApy: row.stressedApy.toNumber(),
    riskScore: row.riskScore,
    miningMarginScore: row.miningMarginScore,
    mode: row.mode,
  };
}

async function buildVault(
  snapshot: VaultSnapshotWithAllocations | null,
  vaultMeta: DashboardVaultMeta,
  markFallback: () => void,
): Promise<DashboardVault> {
  if (snapshot === null) {
    markFallback();
    return {
      aumUsdc: 0,
      delta30dUsdc: 0,
      apyRange: { low: 0, high: 0 },
      stressedApy: 0,
      stressedApyRange: { low: 0, high: 0 },
      riskScore: 0,
      miningMarginScore: 0,
      mode: "balanced",
      asOf: new Date(),
    };
  }

  // Compute 30d AUM delta by finding a snapshot ~30 days older.
  const thirtyDaysAgo = new Date(snapshot.takenAt.getTime() - THIRTY_DAYS_MS);
  const [prior, oldest] = await Promise.all([
    prisma.vaultSnapshot.findFirst({
      where: { takenAt: { lte: thirtyDaysAgo }, ...timelineSnapshotWhere() },
      orderBy: { takenAt: "desc" },
      select: { aumUsdc: true },
    }),
    prisma.vaultSnapshot.findFirst({
      where: timelineSnapshotWhere(),
      orderBy: { takenAt: "asc" },
      select: { aumUsdc: true },
    }),
  ]);
  // If there is no snapshot far enough back, fall back to the oldest one we
  // have. The delta becomes ~"AUM growth across the series".
  const oldestFallback = prior ?? oldest;

  // Decimal → number at the read boundary before arithmetic.
  const oldestAum = oldestFallback ? oldestFallback.aumUsdc.toNumber() : null;
  const delta30dUsdc =
    oldestAum !== null && oldestAum !== snapshot.aumUsdc
      ? Math.round(snapshot.aumUsdc - oldestAum)
      : 0;

  return {
    aumUsdc: snapshot.aumUsdc,
    delta30dUsdc,
    apyRange: { low: snapshot.currentApyLow, high: snapshot.currentApyHigh },
    stressedApy: snapshot.stressedApy,
    stressedApyRange: stressedRangeFor(snapshot.stressedApy),
    riskScore: snapshot.riskScore,
    miningMarginScore: snapshot.miningMarginScore,
    mode: normaliseMode(snapshot.mode),
    asOf: snapshot.takenAt,
  };
}

interface AllocationRow {
  bucket: string;
  pct: number;
  valueUsdc: number;
  yieldContributionBps: number;
}

/**
 * Maps a raw Prisma `Allocation` (Decimal pct/value/bps) onto the number-only
 * `AllocationRow`. Decimal → number at the data boundary.
 */
function toAllocationRow(row: {
  bucket: string;
  pct: Prisma.Decimal;
  valueUsdc: Prisma.Decimal;
  yieldContributionBps: Prisma.Decimal;
}): AllocationRow {
  return {
    bucket: row.bucket,
    pct: row.pct.toNumber(),
    valueUsdc: row.valueUsdc.toNumber(),
    yieldContributionBps: row.yieldContributionBps.toNumber(),
  };
}

function buildAllocations(
  rows: AllocationRow[],
  vaultMeta: DashboardVaultMeta,
  markFallback: () => void,
): DashboardAllocation[] {
  if (rows.length === 0) {
    markFallback();
    return [];
  }
  return rows.map((r) => ({
    bucket: normaliseBucket(r.bucket),
    pct: r.pct,
    valueUsdc: r.valueUsdc,
    yieldContributionBps: r.yieldContributionBps,
  }));
}

async function safeLoadLatestMining(): Promise<{
  hashpriceTrendPct: number;
  operationalConfidence: number;
} | null> {
  try {
    const [m, row] = await Promise.all([
      loadLatestMiningMetrics(),
      // `loadLatestMiningMetrics` returns the agent-shaped input; we need the
      // raw row's `hashpriceTrendPct` + `operationalConfidence`. Pull the row
      // directly to keep the two values aligned with the latest record.
      prisma.miningMetric.findFirst({
        orderBy: { takenAt: "desc" },
        select: { hashpriceTrendPct: true, operationalConfidence: true },
      }),
    ]);
    if (row === null) {
      // `loadLatestMiningMetrics` would have thrown, but guard for type safety.
      return { hashpriceTrendPct: m.difficulty_change_pct, operationalConfidence: FALLBACK_OPERATIONAL_CONFIDENCE };
    }
    return {
      // Decimal → number at the read boundary.
      hashpriceTrendPct: row.hashpriceTrendPct.toNumber(),
      operationalConfidence: row.operationalConfidence,
    };
  } catch {
    return null;
  }
}

function normaliseMode(m: string): VaultMode {
  if (m === "defensive" || m === "balanced" || m === "opportunistic") {
    return m;
  }
  return "balanced";
}

function normaliseBucket(b: string): DashboardAllocationBucket {
  if (
    b === "mining" ||
    b === "btc_tactical" ||
    b === "usdc_base" ||
    b === "stable_reserve"
  ) {
    return b;
  }
  return "mining";
}

// ---------------------------------------------------------------------------
// Time-series builders
// ---------------------------------------------------------------------------

interface TrailingSnapshotRow {
  takenAt: Date;
  aumUsdc: number;
  currentApyLow: number;
  currentApyHigh: number;
}

/**
 * Maps a raw Prisma `VaultSnapshot` slice (Decimal columns) onto the
 * number-only `TrailingSnapshotRow`. Decimal → number at the data boundary.
 */
function toTrailingSnapshotRow(row: {
  takenAt: Date;
  aumUsdc: Prisma.Decimal;
  currentApyLow: Prisma.Decimal;
  currentApyHigh: Prisma.Decimal;
}): TrailingSnapshotRow {
  return {
    takenAt: row.takenAt,
    aumUsdc: row.aumUsdc.toNumber(),
    currentApyLow: row.currentApyLow.toNumber(),
    currentApyHigh: row.currentApyHigh.toNumber(),
  };
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildTimeseries(
  rows: TrailingSnapshotRow[],
  markFallback: () => void,
): DashboardTimeseries {
  if (rows.length < TIMESERIES_MIN_ROWS) {
    markFallback();
    return { nav30d: [], apy30d: [], source: "fallback" };
  }

  // Collapse to one point per day (keep the latest snapshot per UTC date).
  const byDay = new Map<string, TrailingSnapshotRow>();
  for (const r of rows) {
    byDay.set(toIsoDate(r.takenAt), r);
  }

  const ordered = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-30);

  if (ordered.length < 2) {
    markFallback();
    return { nav30d: [], apy30d: [], source: "fallback" };
  }

  const nav30d: NavPoint[] = ordered.map(([date, r]) => ({
    date,
    aum_usdc: r.aumUsdc,
  }));
  const apy30d: ApyPoint[] = ordered.map(([date, r]) => ({
    date,
    apy_low: r.currentApyLow,
    apy_high: r.currentApyHigh,
  }));

  return { nav30d, apy30d, source: "db" };
}

// ---------------------------------------------------------------------------
// loadDashboardForRef — multi-vault bridge (VaultRef → DashboardData)
// ---------------------------------------------------------------------------

/**
 * Loads the dashboard for any {@link VaultRef} — fixture or Prisma deployment.
 *
 * - Fixture refs: the vault profile is derived 1:1 from the engine
 *   `VaultDefinition`; the result is identical to `loadDashboardData(vaultId)`.
 * - Deployment refs: `vaultMeta` is built from the deployment row. Live
 *   snapshot fields (AUM, allocations, mining ops) are NOT yet scoped per
 *   deployment — the DB only carries the Yield Vault timeline. The loader
 *   returns the same live snapshot with `livePreview = true`. No invented data.
 *
 * The legacy `loadDashboardData(vaultId?)` signature is fully preserved; this
 * function is an additive sibling, not a replacement.
 */
export async function loadDashboardForRef(ref: VaultRef): Promise<DashboardData> {
  if (canRunDemoProvider()) {
    const vaultId = ref.kind === "fixture" ? ref.fixture.id : undefined;
    return buildDemoDashboardData(vaultId);
  }

  const profile = toVaultProfile(ref);

  // Determine whether we are on the canonical Yield Vault live timeline.
  // For fixtures: only the "yield" fixture maps to the live timeline.
  // For deployments: no deployment has a separate snapshot table yet — always preview.
  const isYieldFixture =
    ref.kind === "fixture" && ref.fixture.id === VAULT_YIELD.id;
  const livePreview = !isYieldFixture;

  const vaultMeta: DashboardVaultMeta = {
    id: profile.id,
    name: profile.label,
    apyTarget: { low: profile.apyTarget.low, high: profile.apyTarget.high },
    allocationTargets: { ...profile.allocationTargets },
    assumptions: [...profile.assumptions],
    livePreview,
  };

  return buildDashboardFromSnapshot(vaultMeta);
}

// ---------------------------------------------------------------------------
// UI adapter — projects DashboardData onto the existing mock-shaped types.
// Lives here (not in `src/app/...`) so it's tree-shakeable and reusable.
// ---------------------------------------------------------------------------

export type {
  DistributionSnapshot,
  MiningOpsSnapshot,
  VaultMonthlyRow,
  BtcPriceData,
};

