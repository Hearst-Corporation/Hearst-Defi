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
import { getTaxPreview, type TaxPreview } from "@/lib/portfolio/tax";
import {
  coercePortfolioDate,
  resolveProvenance,
} from "@/lib/portfolio/provenance";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoPositionDetail } from "@/lib/demo/builders";
import { DEMO_POSITION_ID } from "@/lib/dev/investor-demo";

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
import type { TimeToCashProps } from "@/components/portfolio/time-to-cash";

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
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  recentTransactions: PortfolioTransaction[];
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

/** Next UTC end-of-month boundary from today. */
function nextEndOfMonth(): Date {
  const now = new Date();
  // Last day of the current UTC month.
  const eom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 0),
  );
  // If today IS the last day, roll to next month.
  if (now.getUTCDate() === eom.getUTCDate()) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 0),
    );
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
      totalYieldYtdUsdc: 0,
      nextDistributionAt: nextEndOfMonth(),
      recentTransactions: [],
      source: "fallback",
    };
  }

  // Fetch positions and both transaction queries in parallel — all 4 are independent.
  const ytdStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [rawPositions, ytdTxs, rawTxs, latestSnapshot] = await Promise.all([
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

  // YTD yield: sum of accrued + distributed (all transaction types) from Jan 1 UTC.
  const totalYieldYtdUsdc =
    ytdTxs.reduce((sum, t) => sum + toNumber(t.amountUsdc), 0) +
    positions.reduce((sum, p) => sum + p.accruedYieldUsdc, 0);

  // Map positionId → vaultName for activity labels.
  const positionVaultMap = new Map(
    rawPositions.map((p) => [
      p.id,
      p.vaultDeployment?.name ?? undefined,
    ]),
  );

  const recentTransactions: PortfolioTransaction[] = rawTxs.map((t) => ({
    id: t.id,
    type: t.type as "deposit" | "claim" | "withdraw" | "distribution",
    amountUsdc: toNumber(t.amountUsdc),
    occurredAt: t.occurredAt,
    txHash: t.txHash,
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

  return {
    positions,
    totalValueUsdc,
    totalYieldYtdUsdc,
    nextDistributionAt: nextEndOfMonth(),
    recentTransactions,
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
export const loadLockMeterProps = cache(async (): Promise<LockMeterProps & { source: "live" | "stale"; updatedAt?: Date }> => {
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
      scores: [
        { dimension: "market",         score: 0, delta30d: 0 },
        { dimension: "mining",         score: 0, delta30d: 0 },
        { dimension: "liquidity",      score: 0, delta30d: 0 },
        { dimension: "smart_contract", score: 0, delta30d: 0 },
        { dimension: "counterparty",   score: 0, delta30d: 0 },
      ],
      composite: 0,
      compositeLabel: undefined,
      composite30dTrend: "stable",
      source: "stale",
    };
  }

  const scores: RiskPulseProps["scores"] = [
    { dimension: "market",         score: 0, delta30d: 0 },
    { dimension: "mining",         score: 0, delta30d: 0 },
    { dimension: "liquidity",      score: 0, delta30d: 0 },
    { dimension: "smart_contract", score: 0, delta30d: 0 },
    { dimension: "counterparty",   score: 0, delta30d: 0 },
  ];

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
    const snapshot = await prisma.vaultSnapshot.findFirst({
      orderBy: { takenAt: "desc" },
      include: { allocations: true },
    });
    return snapshot;
  },
  ["yield-stack-data"],
  { revalidate: 3600, tags: ["yield"] }
);

export const loadYieldStackProps = cache(async (hasPositions: boolean = true): Promise<YieldStackProps & { source: "live" | "stale"; updatedAt?: Date }> => {
  const snapshot = await fetchYieldStackData();

  if (!snapshot || snapshot.allocations.length === 0 || !hasPositions) {
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
}

const BUCKET_ORDER: AllocationBucketSlice["bucket"][] = [
  "mining",
  "btc_tactical",
  "usdc_base",
  "stable_reserve",
];

/**
 * Build allocation-by-bucket slices for the portfolio donut from the latest
 * vault snapshot (same source as the yield stack — shares its 1h cache). Empty
 * when no snapshot / no positions, so the donut renders its preview shell.
 */
export const loadAllocationDonutProps = cache(
  async (hasPositions: boolean = true): Promise<AllocationDonutData> => {
    const snapshot = await fetchYieldStackData();

    if (!snapshot || snapshot.allocations.length === 0 || !hasPositions) {
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
    };
  },
);

/**
 * Build TimeToCashProps from the first active position and vault yield.
 */
export const loadTimeToCashProps = cache(async (): Promise<TimeToCashProps & { source: "live" | "stale"; updatedAt?: Date }> => {
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
// loadTaxPreview — wires `getTaxPreview` to real YTD distribution data
// ---------------------------------------------------------------------------

/**
 * Build a TaxPreview backed by the investor's real positions and YTD
 * distributions.
 *
 * Why this exists: `getTaxPreview` is a pure stub that needs the caller to
 * pass real numbers via its `overrides` param. Without this loader, the LP
 * sees deterministic placeholder amounts (cf. P0-5 in
 * `docs/audit/coherence-2026-05-26/10-portfolio-lp-metrics.md`).
 *
 * Returns null when no investor is logged in so the caller can hide the
 * drawer entirely. Returns a `TaxPreview` even for investors with zero
 * positions — the drawer renders $0 values in that case, which is the
 * correct preview for a brand-new account.
 */
export async function loadTaxPreview(
  year: number = new Date().getUTCFullYear(),
): Promise<TaxPreview | null> {
  const investor = await getInvestor();
  if (!investor) return null;

  // YTD distributions (interest income for 1099-INT and CRS gross interest).
  const ytdStart = new Date(Date.UTC(year, 0, 1));
  const [positions, ytdDistribs] = await Promise.all([
    prisma.position.findMany({
      where: { investorId: investor.id },
      orderBy: { subscribedAt: "asc" },
    }),
    prisma.investorTransaction.findMany({
      where: {
        investorId: investor.id,
        type: { in: ["claim", "distribution"] },
        occurredAt: { gte: ytdStart },
      },
      select: { amountUsdc: true },
    }),
  ]);

  const actualInterestIncomeUsd = ytdDistribs.reduce(
    (sum, t) => sum + toNumber(t.amountUsdc),
    0,
  );
  const actualPrincipalUsd = positions.reduce(
    (sum, p) => sum + toNumber(p.principalUsdc),
    0,
  );
  const actualAccruedYieldUsd = positions.reduce(
    (sum, p) => sum + toNumber(p.accruedYieldUsdc),
    0,
  );
  // Days-held: contribution-weighted average across positions, same as the
  // engine's aggregateLpPnl logic.
  const now = new Date();
  let weightedDays = 0;
  let weightedBase = 0;
  for (const p of positions) {
    const contributed = toNumber(p.principalUsdc);
    if (contributed <= 0) continue;
    const d = daysHeldSince(p.subscribedAt, now);
    weightedDays += contributed * d;
    weightedBase += contributed;
  }
  const actualDaysHeld =
    weightedBase > 0 ? Math.floor(weightedDays / weightedBase) : 0;

  return getTaxPreview(investor.id, year, {
    actualInterestIncomeUsd,
    actualPrincipalUsd,
    actualAccruedYieldUsd,
    actualDaysHeld,
  });
}

// ---------------------------------------------------------------------------
// loadPosition — single position detail for /portfolio/[positionId]
// ---------------------------------------------------------------------------

export async function loadPosition(
  positionId: string,
): Promise<PositionDetail | null> {
  const investor = await getInvestor();
  if (!investor) return null;

  // Demo provider (guard-gated → never production): the recognized demo identity
  // owns exactly one synthetic position (DEMO_POSITION_ID), served from the demo
  // builder so /portfolio/[positionId] does not 404 (D6). source stays "fallback",
  // txHashOpen null — the page banner carries the demo signal.
  if (isDemoInvestor(investor) && positionId === DEMO_POSITION_ID) {
    return buildDemoPositionDetail();
  }

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
  const vaultTicker = "HYV-A";

  const transactions: PositionDetailTransaction[] = rawTxs.map((t) => ({
    id: t.id,
    type: t.type as "deposit" | "claim" | "withdraw" | "distribution",
    amountUsdc: toNumber(t.amountUsdc),
    occurredAt: t.occurredAt,
    txHash: t.txHash,
  }));

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
