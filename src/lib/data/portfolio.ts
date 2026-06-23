import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
// ... existing imports ...
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
import type { ValueSeriesTx } from "@/lib/portfolio/value-series";

export { resolveProvenance };

function asCachedDate(
  value: Date | string | null | undefined,
): Date | undefined {
  return coercePortfolioDate(value) ?? undefined;
}
import {
  METHODOLOGY_FACTORS,
  METHODOLOGY_VERSION,
} from "@/lib/engine/methodology";
import type { LockMeterProps } from "@/components/portfolio/lock-meter";
import type { RiskPulseProps } from "@/components/portfolio/risk-pulse";
import type { DistribCalendarProps, DistribEntry } from "@/components/portfolio/distrib-calendar";
import type { ProofPulseProps } from "@/components/portfolio/proof-pulse";
import type { YieldStackProps } from "@/components/portfolio/yield-stack";
import type { TimeToCashProps } from "@/lib/data/time-to-cash";

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
}

export const POSITION_STATUS_CONFIG = {
  active: { label: "Active", variant: "success", dot: "pf-status-dot--active" },
  matured: { label: "Matured", variant: "warning", dot: "pf-status-dot--matured" },
  exited: { label: "Exited", variant: "default", dot: "pf-status-dot--exited" },
} as const;

export type PositionStatus = keyof typeof POSITION_STATUS_CONFIG;

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

const EMPTY_RISK_SCORES: RiskPulseProps["scores"] = [
  { dimension: "market", score: 0, delta30d: 0 },
  { dimension: "mining", score: 0, delta30d: 0 },
  { dimension: "liquidity", score: 0, delta30d: 0 },
  { dimension: "smart_contract", score: 0, delta30d: 0 },
  { dimension: "counterparty", score: 0, delta30d: 0 },
];

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
 * Resolve the share-class terms for a position.
 *
 * Source of truth: `VaultDeployment.shareClass` (one-letter code, "A" by default).
 * The actual fee / lockup terms come from the engine presets in
 * `src/lib/engine/share-class.ts` (SHARE_CLASS_A, SHARE_CLASS_B) — NEVER from
 * Prisma `@default(200)` (which is a known drift, P0-4 in the LP audit).
 *

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
 * Strict variant for investor portfolio surfaces: returns null unless the
 * position key explicitly carries a `:class-A|B` suffix.
 */
function explicitShareClassTermsFromVaultKey(
  vaultKey: string | null | undefined,
): ShareClassTerms | null {
  if (!vaultKey) return null;
  const match = /:class-([AB])$/i.exec(vaultKey);
  if (!match?.[1]) return null;
  return match[1].toUpperCase() === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
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
      source: "fallback",
    };
  }

  // Fetch positions and both transaction queries in parallel — all 4 are independent.
  const ytdStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const chartStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1),
  );
  const [rawPositions, ytdTxs, rawTxs, chartTxs, latestSnapshot] = await Promise.all([
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
  ]);

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
    pnl,
    source: "live",
    // Snapshot freshness when available; otherwise positions were just read live.
    updatedAt:
      asCachedDate(latestSnapshot?.takenAt) ??
      (positions.length > 0 ? new Date() : undefined),
  };
});

// ---------------------------------------------------------------------------
// Widget props loaders — Section 1/2/3 new widgets
// ---------------------------------------------------------------------------

/**
 * Build LockMeterProps from the first active position.
 */
const loadLockMeterProps = cache(async (): Promise<LockMeterProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const now = new Date();
  const investor = await getInvestor();
  if (!investor) {
    return {
      lockStart: now,
      softLockupDays: 0,
      earlyExitPenaltyBps: 0,
      asOf: now,
      source: "stale",
    };
  }

  const position = await prisma.position.findFirst({
    where: { investorId: investor.id, status: "active" },
    orderBy: { subscribedAt: "asc" },
  });

  if (!position) {
    return {
      lockStart: now,
      softLockupDays: 0,
      asOf: now,
      source: "stale",
    };
  }

  const terms = explicitShareClassTermsFromVaultKey(position.vaultKey);
  return {
    lockStart: position.subscribedAt,
    softLockupDays: terms?.softLockupDays ?? 0,
    asOf: now,
    source: terms ? "live" : "stale",
  };
});

/**
 * Build RiskPulseProps from risk-framework data.
 * Cached cross-request for 1 hour as risk scores change slowly.
 */
const fetchRiskPulseData = unstable_cache(
  async () => {
    const snapshot = await prisma.vaultSnapshot.findFirst({ orderBy: { takenAt: "desc" } });
    return snapshot;
  },
  ["risk-pulse-data"],
  { revalidate: 3600, tags: ["risk"] }
);

export const loadRiskPulseProps = cache(async (): Promise<RiskPulseProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const snapshot = await fetchRiskPulseData();

  if (!snapshot) {
    return {
      scores: EMPTY_RISK_SCORES,
      composite: 0,
      compositeLabel: undefined,
      composite30dTrend: "stable",
      source: "stale",
    };
  }

  const scores = EMPTY_RISK_SCORES;

  // Per-dimension scores are not persisted yet — a headline composite without
  // dimension breakdown would read as a false positive (e.g. 42 / Low–Moderate
  // while every row is N/A).
  const dimensionsPopulated = scores.some((s) => s.score > 0);
  const rawComposite = snapshot.riskScore ?? 0;
  const compositeAvailable = dimensionsPopulated && rawComposite > 0;

  const composite = compositeAvailable ? rawComposite : 0;
  const compositeLabel: RiskPulseProps["compositeLabel"] = compositeAvailable
    ? rawComposite <= 33
      ? "Low"
      : rawComposite <= 50
        ? "Low–Moderate"
        : rawComposite <= 66
          ? "Moderate"
          : rawComposite <= 80
            ? "Elevated"
            : "High"
    : undefined;

  return {
    scores,
    composite,
    compositeLabel,
    composite30dTrend: "stable",
    source: compositeAvailable ? "live" : "stale",
    updatedAt: asCachedDate(snapshot.takenAt),
  };
});

/**
 * Build DistribCalendarProps from Distribution table.
 */
export const loadDistribCalendarProps = cache(async (): Promise<DistribCalendarProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const investor = await getInvestor();

  if (!investor) {
    return {
      entries: [],
      shareClass: null,
      cadence: null,
      source: "stale",
    };
  }

  const firstActive = await prisma.position.findFirst({
    where: { investorId: investor.id, status: "active" },
    orderBy: { subscribedAt: "asc" },
    include: { vaultDeployment: true },
  });
  const terms = firstActive
    ? explicitShareClassTermsFromVaultKey(firstActive.vaultKey)
    : null;

  const rawDistribs = await prisma.investorTransaction.findMany({
    where: {
      investorId: investor.id,
      type: "distribution",
      occurredAt: {
        gte: new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1)),
      },
    },
    orderBy: { occurredAt: "asc" },
    take: 12,
  });

  if (rawDistribs.length === 0) {
    return {
      entries: [],
      shareClass: terms?.shareClass ?? null,
      cadence: terms ? cadenceFromTerms(terms) : null,
      source: "stale",
    };
  }

  const entries: DistribEntry[] = rawDistribs.map((tx) => {
    const d = tx.occurredAt;
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      period,
      amountUsdc: toNumber(tx.amountUsdc),
      paidAt: tx.occurredAt,
      txHash: tx.txHash ?? undefined,
    };
  });

  return {
    entries,
    shareClass: terms?.shareClass ?? null,
    cadence: terms ? cadenceFromTerms(terms) : null,
    source: "live",
    updatedAt: rawDistribs[rawDistribs.length - 1]?.occurredAt,
  };
});

/**
 * Build ProofPulseProps from the Proof table (latest PoR).
 * Cached cross-request for 1 hour.
 */
const fetchProofData = unstable_cache(
  async () => {
    const latestProof = await prisma.proof.findFirst({
      where: { proofType: "custody" },
      orderBy: { postedAt: "desc" },
    });
    const snapshot = await prisma.vaultSnapshot.findFirst({
      orderBy: { takenAt: "desc" },
      select: { aumUsdc: true },
    });
    return { latestProof, snapshot };
  },
  ["proof-pulse-data"],
  { revalidate: 3600, tags: ["proof"] }
);

export const loadProofPulseProps = cache(async (): Promise<ProofPulseProps & { source: "live" | "stale" | "attested"; updatedAt?: Date }> => {
  const now = new Date();
  const { latestProof, snapshot } = await fetchProofData();

  if (!latestProof) {
    return {
      lastPor: { timestamp: now, statedTvlUsdc: 0, onChainTvlUsdc: 0 },
      methodologyVersion: "",
      methodologyLocked: false,
      nextAttestation: null,
      auditor: "",
      source: "stale",
    };
  }

  const statedTvlUsdc = snapshot ? toNumber(snapshot.aumUsdc) : 0;
  const onChainTvlUsdc = 0; // Populated in Phase 2

  const postedAt = asCachedDate(latestProof.postedAt) ?? now;

  return {
    lastPor: {
      timestamp: postedAt,
      statedTvlUsdc,
      onChainTvlUsdc,
    },
    methodologyVersion: "",
    methodologyLocked: false,
    nextAttestation: null,
    auditor: "",
    source: "attested", // Proof exists, so it's attested
    updatedAt: postedAt,
  };
});

/**
 * Build YieldStackProps from vault allocation data.
 * Cached cross-request for 1 hour.
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
  { revalidate: 3600, tags: ["yield"] }
);

export const loadYieldStackProps = cache(async (_hasPositions: boolean = true): Promise<YieldStackProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const snapshot = await fetchYieldStackData();

  if (!snapshot || snapshot.allocations.length === 0) {
    return {
      sources: [],
      blendedLow: 0,
      blendedHigh: 0,
      stressedBearRange: { low: 0, high: 0 },
      methodologyVersion: METHODOLOGY_VERSION,
      source: "stale",
    };
  }

  const labelMap: Record<string, string> = {
    mining: "Mining cashflow",
    usdc_base: "USDC base yield",
    btc_tactical: "BTC tactical",
    stable_reserve: "Stable reserve",
  };

  const sources: YieldStackProps["sources"] = snapshot.allocations.map((alloc) => {
    const bucket = alloc.bucket as "mining" | "usdc_base" | "btc_tactical" | "stable_reserve";
    const contributionBps = toNumber(alloc.yieldContributionBps);
    return {
      bucket,
      label: labelMap[bucket] ?? bucket,
      contributionPct: contributionBps / 100,
      isVolatile: bucket === "btc_tactical",
    };
  });

  const blendedLow = toNumber(snapshot.currentApyLow);
  const blendedHigh = toNumber(snapshot.currentApyHigh);
  const stressedCenter = toNumber(snapshot.stressedApy);
  const stressedHalfBand = METHODOLOGY_FACTORS.STRESSED_APY_POINT_HALF_BAND;
  const stressedBearRange = {
    low: Math.round((stressedCenter - stressedHalfBand) * 10) / 10,
    high: Math.round((stressedCenter + stressedHalfBand) * 10) / 10,
  };

  return {
    sources,
    blendedLow,
    blendedHigh,
    stressedBearRange,
    methodologyVersion: METHODOLOGY_VERSION,
    source: "live",
    updatedAt: asCachedDate(snapshot.takenAt),
  };
});

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

/**
 * Build TimeToCashProps from the first active position and vault yield.
 */
const loadTimeToCashProps = cache(async (): Promise<TimeToCashProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const now = new Date();
  const investor = await getInvestor();
  
  const cycleStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cycleDays = 30;

  if (!investor) {
    return {
      cycleStart,
      cycleDays,
      projectedUsdc: 0,
      aprLow: 0,
      aprHigh: 0,
      asOf: now,
      source: "stale",
    };
  }

  const [position, snapshot] = await Promise.all([
    prisma.position.findFirst({
      where: { investorId: investor.id, status: "active" },
      orderBy: { subscribedAt: "asc" },
    }),
    fetchYieldStackData(),
  ]);

  if (!position || !snapshot) {
    return {
      cycleStart,
      cycleDays,
      projectedUsdc: 0,
      aprLow: 0,
      aprHigh: 0,
      asOf: now,
      source: "stale",
    };
  }

  const principal = toNumber(position.principalUsdc);
  const aprLow = toNumber(snapshot.currentApyLow);
  const aprHigh = toNumber(snapshot.currentApyHigh);

  const avgApr = (aprLow + aprHigh) / 2;
  const projectedUsdc = (principal * (avgApr / 100)) / 12;

  const hasMeaningfulYield = aprLow + aprHigh > 0 && projectedUsdc > 0;

  return {
    cycleStart,
    cycleDays,
    projectedUsdc,
    aprLow,
    aprHigh,
    asOf: now,
    source: hasMeaningfulYield ? "live" : "stale",
    updatedAt: asCachedDate(snapshot.takenAt),
  };
});

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
