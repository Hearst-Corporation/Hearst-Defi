import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
import {
  aggregateLpPnl,
  computeLpPnl,
  daysHeldSince,
  type LpPnl,
} from "@/lib/engine/lp-pnl";
import {
  SHARE_CLASS_A,
  SHARE_CLASS_B,
  type ShareClassTerms,
} from "@/lib/engine/share-class";

import {
  coercePortfolioDate,
  resolveProvenance,
} from "@/lib/portfolio/provenance";
import { computeYtdYieldUsdc } from "@/lib/portfolio/yield-ytd";
import type { HourlyValueSnapshot, ValueSeriesTx } from "@/lib/portfolio/value-series";
import {
  loadHourlyValueSnapshots,
  reconstructInvestorNavSeries,
} from "@/lib/portfolio/investor-nav-snapshot";

export { resolveProvenance };

function asCachedDate(
  value: Date | string | null | undefined,
): Date | undefined {
  return coercePortfolioDate(value) ?? undefined;
}

// ---------------------------------------------------------------------------
// PositionDetail — extended view for the /portfolio/[positionId] page
// ---------------------------------------------------------------------------

export interface PositionDetailTransaction {
  id: string;
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
  txHash: string | null;
}

export interface PositionDetail {
  id: string;
  vaultName: string | null;
  vaultTicker: string;
  /** Soft-lockup days from the vault's share-class terms (0 when unknown). */
  softLockupDays: number;
  /** Vault total capacity (VaultDeployment.capacityUsdc), null when unknown. Used to derive the investor's fleet share for mining tiles — never re-fetched, already in the joined row. */
  capacityUsdc: number | null;
  status: "active" | "matured" | "exited";
  principalUsdc: number;
  accruedYieldUsdc: number;
  distributedUsdc: number;
  realizedApyLow: number | null;  // pct, e.g. 9.4
  realizedApyHigh: number | null; // pct, e.g. 12.8
  subscribedAt: Date;
  maturedAt: Date | null;
  txHashOpen: string | null;
  transactions: PositionDetailTransaction[];
  /** Computed P&L for this position. Optional — consumers render when present. */
  pnl?: LpPnl;
  /** "live" = real DB data, "fallback" = demo / unauthenticated */
  source: "live" | "fallback";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioPosition {
  id: string;
  vaultName: string | null;
  principalUsdc: number;
  accruedYieldUsdc: number;
  distributedUsdc: number;
  /** principal + accrued */
  valueUsdc: number;
  status: "active" | "matured" | "exited";
  /** bps converted to pct, e.g. 940 → 9.4 */
  apyLow: number | null;
  apyHigh: number | null;
  subscribedAt: Date;
  /**
   * Next monthly distribution boundary for THIS position, or null when this
   * position honestly has none coming — matured/exited (no more accrual
   * period ahead) or a zero/unknown yield range (nothing would accrue to
   * distribute). Never falls back to a shared portfolio-wide date: per-row
   * honesty was the whole point (was previously identical across every row,
   * including matured/zero-yield ones).
   */
  nextDistributionAt: Date | null;
}

export const POSITION_STATUS_CONFIG = {
  active: { label: "Active", variant: "success", dot: "pf-status-dot--active" },
  matured: { label: "Matured", variant: "warning", dot: "pf-status-dot--matured" },
  exited: { label: "Exited", variant: "default", dot: "pf-status-dot--exited" },
} as const;

export interface PortfolioTransaction {
  id: string;
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
  txHash: string | null;
  positionVaultName?: string;
}

export interface PortfolioData {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  /** Total principal deployed (sum of position.principalUsdc). */
  deployedUsdc: number;
  /** Total accrued yield across all positions. */
  accruedYieldUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  recentTransactions: PortfolioTransaction[];
  /** Ledger rows for the 12-month value chart (deposit / payout anchors). */
  valueChartTransactions: ValueSeriesTx[];
  /**
   * Hourly (or finer) investor NAV prints for the value chart.
   * Sourced from InvestorNavSnapshot rows (investor-nav-snapshot-hourly cron).
   * Empty when no prints exist yet — chart falls back to ledger_sparse.
   */
  hourlyValueSnapshots: HourlyValueSnapshot[];
  /** Aggregate P&L across positions. Optional — consumers render when present. */
  pnl?: LpPnl;
  /** "live" = real DB data, "fallback" = unauthenticated / empty state */
  source: "live" | "fallback";
  /** Timestamp of the latest underlying snapshot used for this data. */
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UTC last instant of a calendar month (month is 0-based). */
function utcEndOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 0));
}

/** Next UTC end-of-month boundary from today. */
function nextEndOfMonth(): Date {
  const now = new Date();
  const eom = utcEndOfMonth(now.getUTCFullYear(), now.getUTCMonth());
  if (now.getUTCDate() === eom.getUTCDate()) {
    return utcEndOfMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }
  return eom;
}

/**
 * Per-position next distribution boundary — honest, never a portfolio-wide
 * fallback. A position only has a next distribution when it is still
 * `active` AND carries a real (non-zero) yield range: a matured/exited
 * position has no more accrual period ahead, and a zero/unknown-APY position
 * would accrue nothing to distribute. Returns null in every other case so
 * the UI can render "—" instead of a fabricated shared date.
 */
function nextDistributionForPosition(
  status: "active" | "matured" | "exited",
  apyLow: number | null,
  apyHigh: number | null,
): Date | null {
  if (status !== "active") return null;
  const hasYield = (apyLow ?? 0) > 0 || (apyHigh ?? 0) > 0;
  if (!hasYield) return null;
  return nextEndOfMonth();
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  // Prisma Decimal
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

function bpsToApyPct(bps: number): number {
  return Math.round((bps / 100) * 10) / 10;
}

type InvestorTxRow = {
  id: string;
  type: string;
  amountUsdc: unknown;
  occurredAt: Date;
  txHash: string | null;
};

function mapInvestorTransactionRow(t: InvestorTxRow): PositionDetailTransaction {
  return {
    id: t.id,
    type: t.type as PositionDetailTransaction["type"],
    amountUsdc: toNumber(t.amountUsdc),
    occurredAt: t.occurredAt,
    txHash: t.txHash,
  };
}

// ---------------------------------------------------------------------------
// Share-class resolution
// ---------------------------------------------------------------------------

/**
 * Derive the share-class code ("A" | "B") from a position's vaultKey.
 *
 * subscribe.ts stores the class as a `:class-X` suffix (e.g.
 * "hearst-yield-vault:class-B"). This helper parses that suffix and falls
 * back to "A" when the key predates the suffix convention or has no match.
 *
 * Exported for unit tests; not part of the public API of this module.
 */
export function shareClassCodeFromVaultKey(vaultKey: string | null | undefined): "A" | "B" {
  if (!vaultKey) return "A";
  const match = /:class-([AB])$/i.exec(vaultKey);
  if (!match?.[1]) return "A";
  return match[1].toUpperCase() as "A" | "B";
}

/**
 * Select SHARE_CLASS_A or SHARE_CLASS_B from the vaultKey suffix stored by
 * subscribe.ts. Delegates to shareClassCodeFromVaultKey, then maps to the
 * engine preset. Default = class A.
 *
 * Exported for unit tests; not part of the public API of this module.
 */
export function shareClassTermsFromVaultKey(vaultKey: string | null | undefined): ShareClassTerms {
  return shareClassCodeFromVaultKey(vaultKey) === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
}

/**
 * Derive the distribution cadence string from a ShareClassTerms preset.
 * Class B has a longer soft lock-up (90 days) but the same monthly distribution
 * schedule — both classes distribute monthly, T+5.
 *
 * Exported for unit tests; not part of the public API of this module.
 */
export function cadenceFromTerms(_terms: ShareClassTerms): string {
  // Both class A and B distribute monthly on day 1, settlement T+5.
  // If a third class with a different cadence is introduced, extend here.
  return "monthly, T+5";
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Core portfolio data loader. Cached per-request.
 */
export const loadPortfolio = cache(async (): Promise<PortfolioData> => {
  const investor = await getInvestor();

  if (!investor) {
    return {
      positions: [],
      totalValueUsdc: 0,
      deployedUsdc: 0,
      accruedYieldUsdc: 0,
      totalYieldYtdUsdc: 0,
      nextDistributionAt: nextEndOfMonth(),
      recentTransactions: [],
      valueChartTransactions: [],
      hourlyValueSnapshots: [],
      source: "fallback",
    };
  }

  // Fetch positions and both transaction queries in parallel — all 4 are independent.
  const ytdStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const chartStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1),
  );
  const [rawPositions, ytdTxs, rawTxs, chartTxs, latestSnapshot, navSnapshots] = await Promise.all([
    prisma.position.findMany({
      where: { investorId: investor.id },
      include: { vaultDeployment: true },
      orderBy: { subscribedAt: "desc" },
      take: 100,
    }),
    prisma.investorTransaction.findMany({
      where: {
        investorId: investor.id,
        type: { in: ["claim", "distribution"] },
        occurredAt: { gte: ytdStart },
      },
      select: { amountUsdc: true },
      take: 100,
    }),
    prisma.investorTransaction.findMany({
      where: { investorId: investor.id },
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    prisma.investorTransaction.findMany({
      where: {
        investorId: investor.id,
        occurredAt: { gte: chartStart },
      },
      orderBy: { occurredAt: "asc" },
      select: { type: true, amountUsdc: true, occurredAt: true },
      take: 500,
    }),
    prisma.vaultSnapshot.findFirst({
      orderBy: { takenAt: "desc" },
      select: { takenAt: true },
    }),
    loadHourlyValueSnapshots(investor.id, chartStart),
  ]);

  // Prefer real persisted hourly prints, but only when they actually VARY. The
  // cron records principal + *current* accrued at every hour, so a static
  // position back-fills as a flat constant series (every past row shows today's
  // total) — that reads as a dead-flat line and misrepresents history. When the
  // persisted series has <2 distinct values (sparse OR constant), reconstruct the
  // value path deterministically from the real position anchors instead. Zero
  // accounts reconstruct to [] (stay empty).
  const distinctValues = new Set(navSnapshots.map((s) => s.valueUsdc)).size;
  const valueSeries =
    distinctValues >= 2
      ? navSnapshots
      : await reconstructInvestorNavSeries(investor.id, chartStart);

  const positions: PortfolioPosition[] = rawPositions.map((p) => {
    const principal = toNumber(p.principalUsdc);
    const accrued = toNumber(p.accruedYieldUsdc);
    const distributed = toNumber(p.distributedUsdc);

    const apyLowBps = p.vaultDeployment?.targetApyLowBps ?? null;
    const apyHighBps = p.vaultDeployment?.targetApyHighBps ?? null;
    const vaultName = p.vaultDeployment?.name ?? null;

    const status = p.status as "active" | "matured" | "exited";

    return {
      id: p.id,
      vaultName,
      principalUsdc: principal,
      accruedYieldUsdc: accrued,
      distributedUsdc: distributed,
      valueUsdc: principal + accrued,
      status,
      apyLow: apyLowBps === null ? null : bpsToApyPct(apyLowBps),
      apyHigh: apyHighBps === null ? null : bpsToApyPct(apyHighBps),
      subscribedAt: p.subscribedAt,
      nextDistributionAt: nextDistributionForPosition(
        status,
        apyLowBps === null ? null : bpsToApyPct(apyLowBps),
        apyHighBps === null ? null : bpsToApyPct(apyHighBps),
      ),
    };
  });

  const totalValueUsdc = positions.reduce((sum, p) => sum + p.valueUsdc, 0);

  const ytdPayoutRows = ytdTxs.map((t) => ({ amountUsdc: toNumber(t.amountUsdc) }));
  const accruedPendingUsdc = positions.reduce((sum, p) => sum + p.accruedYieldUsdc, 0);
  const totalYieldYtdUsdc = computeYtdYieldUsdc(ytdPayoutRows, accruedPendingUsdc);

  const valueChartTransactions: ValueSeriesTx[] = chartTxs.map((t) => ({
    type: t.type as ValueSeriesTx["type"],
    amountUsdc: toNumber(t.amountUsdc),
    occurredAt: t.occurredAt,
  }));

  // Map positionId → vaultName for activity labels.
  const positionVaultMap = new Map(
    rawPositions.map((p) => [
      p.id,
      p.vaultDeployment?.name ?? undefined,
    ]),
  );

  const recentTransactions: PortfolioTransaction[] = rawTxs.map((t) => ({
    ...mapInvestorTransactionRow(t),
    positionVaultName: t.positionId
      ? (positionVaultMap.get(t.positionId) ?? undefined)
      : undefined,
  }));

  // Aggregate P&L across positions (clock passed in to keep the engine pure).
  const now = new Date();
  const pnl = aggregateLpPnl(
    rawPositions.map((p) => ({
      contributedUsdc: toNumber(p.principalUsdc),
      distributedUsdc: toNumber(p.distributedUsdc),
      accruedYieldUsdc: toNumber(p.accruedYieldUsdc),
      daysHeld: daysHeldSince(p.subscribedAt, now),
    })),
  );

  const deployedUsdc = positions.reduce((sum, p) => sum + p.principalUsdc, 0);
  const accruedYieldUsdc = positions.reduce((sum, p) => sum + p.accruedYieldUsdc, 0);

  return {
    positions,
    totalValueUsdc,
    deployedUsdc,
    accruedYieldUsdc,
    totalYieldYtdUsdc,
    nextDistributionAt: nextEndOfMonth(),
    recentTransactions,
    valueChartTransactions,
    hourlyValueSnapshots: valueSeries,
    pnl,
    source: "live",
    // Snapshot freshness when available; otherwise positions were just read live.
    updatedAt:
      asCachedDate(latestSnapshot?.takenAt) ??
      (positions.length > 0 ? new Date() : undefined),
  };
});

// ---------------------------------------------------------------------------
// loadInvestorDistributions — ALL distribution transactions across ALL of the
// investor's positions (not capped to the 5-row, all-types recentTransactions
// feed used elsewhere). Powers the /portfolio "Yield & distributions" card,
// which must reconcile with the header's investor-wide `distributedUsdc`.
// ---------------------------------------------------------------------------

export interface InvestorDistribution {
  id: string;
  amountUsdc: number;
  occurredAt: Date;
  txHash: string | null;
  vaultName?: string;
}

export const loadInvestorDistributions = cache(
  async (limit = 24): Promise<InvestorDistribution[]> => {
    const investor = await getInvestor();
    if (!investor) return [];

    const rows = await prisma.investorTransaction.findMany({
      where: { investorId: investor.id, type: "distribution" },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: { position: { include: { vaultDeployment: true } } },
    });

    return rows.map((t) => ({
      id: t.id,
      amountUsdc: toNumber(t.amountUsdc),
      occurredAt: t.occurredAt,
      txHash: t.txHash,
      vaultName: t.position?.vaultDeployment?.name ?? undefined,
    }));
  },
);

// ---------------------------------------------------------------------------
// Widget props loaders — Section 1/2/3 new widgets
// ---------------------------------------------------------------------------

/**
 * Build the yield stack data from vault allocation data.
 * Short-cached cross-request: allocation snapshots change at most hourly (custody
 * cron), but a 1h TTL meant a freshly-landed snapshot — or a just-cleared one —
 * left the Capital & Yield donut stale/empty for up to an hour. A 60s window
 * keeps the read cheap while letting the donut self-heal quickly; the "yield"
 * tag is still busted explicitly on snapshot writes/demo reset for immediacy.
 */
const fetchYieldStackData = unstable_cache(
  async () => {
    // Latest snapshot that actually carries allocations. The daily timeline
    // snapshots (orderBy takenAt desc) hold only headline APY/AUM — allocation
    // breakdowns live on the preset snapshots. Filtering on `allocations.some`
    // avoids returning a newer-but-allocation-less snapshot, which silently
    // collapsed Capital & Yield + the allocation donut to their empty state.
    const snapshot = await prisma.vaultSnapshot.findFirst({
      where: { allocations: { some: {} } },
      orderBy: { takenAt: "desc" },
      include: { allocations: true },
    });
    return snapshot;
  },
  ["yield-stack-data"],
  { revalidate: 60, tags: ["yield"] }
);

export interface AllocationBucketSlice {
  bucket: "mining" | "btc_tactical" | "usdc_base" | "stable_reserve";
  pct: number;
  valueUsdc: number;
}

export interface AllocationDonutData {
  buckets: AllocationBucketSlice[];
  source: "live" | "stale";
  updatedAt?: Date;
  /** Vault AUM from the snapshot — present when snapshot exists, used as donut centre label without investor positions. */
  aumUsdc?: number;
}

const BUCKET_ORDER: AllocationBucketSlice["bucket"][] = [
  "mining",
  "btc_tactical",
  "usdc_base",
  "stable_reserve",
];

/**
 * Build allocation-by-bucket slices for the portfolio donut from the latest
 * vault snapshot (same source as the yield stack — shares its 1h cache). Always
 * returns vault data when a snapshot exists, regardless of investor position state.
 * The `aumUsdc` field allows the donut centre to show vault AUM instead of "$0 Capital"
 * when the investor has no positions yet.
 */
export const loadAllocationDonutProps = cache(
  async (_hasPositions: boolean = true): Promise<AllocationDonutData> => {
    const snapshot = await fetchYieldStackData();

    if (!snapshot || snapshot.allocations.length === 0) {
      return { buckets: [], source: "stale" };
    }

    const slices: AllocationBucketSlice[] = snapshot.allocations
      .map((alloc) => ({
        bucket: alloc.bucket as AllocationBucketSlice["bucket"],
        pct: toNumber(alloc.pct),
        valueUsdc: toNumber(alloc.valueUsdc),
      }))
      .sort(
        (a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket),
      );

    return {
      buckets: slices,
      source: "live",
      updatedAt: asCachedDate(snapshot.takenAt),
      aumUsdc: toNumber(snapshot.aumUsdc),
    };
  },
);

// ---------------------------------------------------------------------------
// loadPosition — single position detail for /portfolio/[positionId]
// ---------------------------------------------------------------------------

export async function loadPosition(
  positionId: string,
): Promise<PositionDetail | null> {
  const investor = await getInvestor();
  if (!investor) return null;

  const [raw, rawTxs] = await Promise.all([
    prisma.position.findFirst({
      where: { id: positionId, investorId: investor.id },
      include: { vaultDeployment: true },
    }),
    // Load all transactions for this position (positionId + investorId are
    // already known — independent of the position row itself)
    prisma.investorTransaction.findMany({
      where: { investorId: investor.id, positionId },
      orderBy: { occurredAt: "desc" },
    }),
  ]);
  if (!raw) return null;

  const principal = toNumber(raw.principalUsdc);
  const accrued = toNumber(raw.accruedYieldUsdc);
  const distributed = toNumber(raw.distributedUsdc);

  const apyLowBps = raw.vaultDeployment?.targetApyLowBps ?? null;
  const apyHighBps = raw.vaultDeployment?.targetApyHighBps ?? null;
  const vaultName = raw.vaultDeployment?.name ?? null;
  const vaultTicker = raw.vaultDeployment?.ticker ?? "HYV-A";
  const softLockupDays = raw.vaultDeployment?.softLockupDays ?? 0;
  const capacityUsdc = raw.vaultDeployment
    ? toNumber(raw.vaultDeployment.capacityUsdc)
    : null;

  const transactions: PositionDetailTransaction[] = rawTxs.map(mapInvestorTransactionRow);

  // txHashOpen: find the opening deposit transaction hash
  const openTx = rawTxs.find((t) => t.type === "deposit");

  const pnl = computeLpPnl({
    contributedUsdc: principal,
    distributedUsdc: distributed,
    accruedYieldUsdc: accrued,
    daysHeld: daysHeldSince(raw.subscribedAt, new Date()),
  });

  return {
    id: raw.id,
    vaultName,
    vaultTicker,
    softLockupDays,
    capacityUsdc,
    status: raw.status as "active" | "matured" | "exited",
    principalUsdc: principal,
    accruedYieldUsdc: accrued,
    distributedUsdc: distributed,
    realizedApyLow: apyLowBps === null ? null : bpsToApyPct(apyLowBps),
    realizedApyHigh: apyHighBps === null ? null : bpsToApyPct(apyHighBps),
    subscribedAt: raw.subscribedAt,
    maturedAt: null, // populated in Phase 2
    txHashOpen: openTx?.txHash ?? null,
    transactions,
    pnl,
    source: "live",
  };
}
