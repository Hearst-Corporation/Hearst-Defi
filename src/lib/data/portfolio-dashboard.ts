import "server-only";

import { cache } from "react";

import type { ChartValuePoint } from "@/components/catalyst/chart-types";
import { getInvestor } from "@/lib/auth/session";
import {
  buildYieldHistory,
  type YieldHistory,
  type YieldTxn,
} from "@/lib/portfolio/yield-history";

import {
  loadInvestorDistributions,
  loadPortfolio,
  loadPosition,
  type PortfolioPosition,
} from "./portfolio";

/**
 * portfolio-dashboard — the /portfolio view model, derived ONLY from real data.
 *
 * Every field here comes from the investor's own persisted position(s),
 * transactions and NAV prints (via `loadPortfolio` / `loadPosition`). There is
 * NO mock, no fabricated number: a zero-position investor yields `hasPosition:
 * false` and every metric at 0 / empty. Strategy / mining / agent panels are
 * intentionally NOT modeled here — they have no real data source yet.
 *
 * Honesty rules baked in: APY is always a LOW→HIGH range (never a point);
 * projected yield is a range, realized yield is what was actually paid.
 */

export interface PortfolioDistribution {
  id: string;
  amountUsdc: number;
  paidAt: Date;
  txHash: string | null;
  vaultName?: string;
}

export interface PortfolioDashboard {
  /** true once the investor holds at least one position. */
  hasPosition: boolean;
  /** Investor KYC status (real, from the Investor row). null when unauthenticated. */
  kycStatus: string | null;
  /** Share class of the anchor position ("A" | "B"), null when none. */
  shareClass: "A" | "B" | null;
  /** Sum of principal deployed across positions. */
  depositUsdc: number;
  /** Sum of principal + accrued (current mark-to-book value). */
  currentValueUsdc: number;
  /** Sum of accrued (unpaid) yield. `null` when nothing computes it — which is
   *  every production path for Series 1 (see PortfolioData.accruedYieldUsdc). */
  accruedUsdc: number | null;
  /** Yield actually paid out to date (sum of distributions). */
  distributedUsdc: number;
  /** currentValue vs deposit, in pct (0 when no deposit). */
  totalChangePct: number;
  /** APY range from the vault deployment (pct). null when unknown. */
  apyLow: number | null;
  apyHigh: number | null;
  /** Soft lock-up from the first active position's share class (days). */
  lockupDays: number;
  /** Days elapsed since the first active position was subscribed. */
  lockupElapsedDays: number;
  /** Days remaining in the soft lock-up (0 once cleared). */
  lockupRemainingDays: number;
  /** Anchor position's vault total capacity (VaultDeployment.capacityUsdc), null when unknown. Used to derive the investor's fleet share for mining tiles. */
  vaultCapacityUsdc: number | null;
  /** Subscription date of the first active position (null when none). */
  subscribedAt: Date | null;
  /** Next scheduled distribution boundary. `null` for a product with no
   *  periodic distribution — Series 1 pays none. */
  nextDistributionAt: Date | null;
  /** Position status of the first active position. */
  status: PortfolioPosition["status"] | null;
  /** Value-over-time series (real NAV prints or reconstructed anchors). */
  navPoints: ChartValuePoint[];
  /** Monthly realized + projected-range yield series (null when no position). */
  yieldHistory: YieldHistory | null;
  /** Real distribution payouts, newest first. */
  distributions: PortfolioDistribution[];
  /** All positions (for listing when the investor holds several). */
  positions: PortfolioPosition[];
  /** "live" = real DB data, "fallback" = unauthenticated / empty. */
  source: "live" | "fallback";
  updatedAt?: Date;
}

/**
 * Build the /portfolio dashboard view model for the signed-in investor.
 *
 * Reuses `loadPortfolio` (positions, NAV series, activity) and `loadPosition`
 * (the first active position's transactions + share-class lock-up) so it never
 * re-runs queries the portfolio loader already made. Cached per-request.
 */
export const loadPortfolioDashboard = cache(
  async (): Promise<PortfolioDashboard> => {
    const now = new Date();
    // Investor-wide distributions (ALL positions) — the single source of truth
    // for both the "Distribution history" list and the yield-history bars, so
    // they reconcile with the header's investor-wide `distributedUsdc` instead
    // of the anchor-position-only / take-5-all-types `recentTransactions` feed.
    const [portfolio, investor, investorDistributions] = await Promise.all([
      loadPortfolio(),
      getInvestor(),
      loadInvestorDistributions(),
    ]);
    const kycStatus = investor?.kycStatus ?? null;

    const positions = portfolio.positions;
    const hasPosition = positions.length > 0;

    // Empty / unauthenticated → a real zero dashboard (no invented figures).
    if (!hasPosition) {
      return {
        hasPosition: false,
        kycStatus,
        shareClass: null,
        depositUsdc: 0,
        currentValueUsdc: 0,
        // null, not 0: no position means nothing accrues, and nothing computes
        // this figure anyway. A 0 would read as a measured nil accrual.
        accruedUsdc: null,
        distributedUsdc: 0,
        totalChangePct: 0,
        apyLow: null,
        apyHigh: null,
        lockupDays: 0,
        lockupElapsedDays: 0,
        lockupRemainingDays: 0,
        vaultCapacityUsdc: null,
        subscribedAt: null,
        nextDistributionAt: portfolio.nextDistributionAt,
        status: null,
        navPoints: [],
        yieldHistory: null,
        distributions: [],
        positions: [],
        source: portfolio.source,
        updatedAt: portfolio.updatedAt,
      };
    }

    const depositUsdc = portfolio.deployedUsdc;
    const accruedUsdc = portfolio.accruedYieldUsdc;
    const currentValueUsdc = portfolio.totalValueUsdc;
    const distributedUsdc = positions.reduce(
      (sum, p) => sum + p.distributedUsdc,
      0,
    );
    const totalChangePct =
      depositUsdc > 0
        ? ((currentValueUsdc - depositUsdc) / depositUsdc) * 100
        : 0;

    // Anchor the lock-up on the OLDEST active position (the one that started the
    // lock clock). Fall back to the most recent position when none is active.
    // `loadPortfolio` orders positions subscribedAt desc.
    const anchorPosition =
      [...positions]
        .filter((p) => p.status === "active")
        .sort((a, b) => a.subscribedAt.getTime() - b.subscribedAt.getTime())[0] ??
      positions[positions.length - 1] ??
      null;

    // The portfolio's real start date is the OLDEST subscription across ALL
    // positions (not just the lock-up anchor) — used to seed the yield-history
    // series so it covers the investor's full history, not just one position.
    const oldestSubscribedAt = [...positions].sort(
      (a, b) => a.subscribedAt.getTime() - b.subscribedAt.getTime(),
    )[0]?.subscribedAt ?? null;

    const apyLow = anchorPosition?.apyLow ?? null;
    const apyHigh = anchorPosition?.apyHigh ?? null;

    // Detail load = the anchor position's transactions + its share-class soft
    // lock-up (softLockupDays lives on the VaultDeployment, resolved by loadPosition).
    const detail = anchorPosition
      ? await loadPosition(anchorPosition.id)
      : null;

    // Share class from the anchor position's ticker suffix (e.g. "HYV-B" → "B").
    const shareClass: "A" | "B" | null = detail
      ? detail.vaultTicker.trim().toUpperCase().endsWith("B")
        ? "B"
        : "A"
      : null;

    const subscribedAt = anchorPosition?.subscribedAt ?? null;
    const lockupDays = detail?.softLockupDays ?? 0;
    const lockupElapsedDays = subscribedAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - subscribedAt.getTime()) / 86_400_000),
        )
      : 0;
    const lockupRemainingDays = Math.max(0, lockupDays - lockupElapsedDays);
    const vaultCapacityUsdc = detail?.capacityUsdc ?? null;

    // NAV series → chart points. Real hourly prints when they vary, else the
    // deterministic reconstruction loadPortfolio already resolved. Empty stays empty.
    const navPoints: ChartValuePoint[] = portfolio.hourlyValueSnapshots.map((s) => ({
      at: s.at,
      value: s.valueUsdc,
    }));

    // Yield history reconciled with the header: ALL investor-wide distribution
    // transactions (not just the anchor position's), and the TOTAL deposited
    // principal across positions (`depositUsdc`, already computed above from
    // `portfolio.deployedUsdc`) — so the realized bars sum to the same total as
    // "paid to date" and the projected next-payout range reflects the whole
    // portfolio, not one position.
    const yieldTransactions: YieldTxn[] = investorDistributions.map((t) => ({
      type: "distribution" as const,
      amountUsdc: t.amountUsdc,
      occurredAt: t.occurredAt,
    }));
    const yieldHistory: YieldHistory | null =
      anchorPosition && oldestSubscribedAt
        ? buildYieldHistory({
            transactions: yieldTransactions,
            principalUsdc: depositUsdc,
            realizedApyLowPct: apyLow ?? 0,
            realizedApyHighPct: apyHigh ?? 0,
            subscribedAt: oldestSubscribedAt,
            maturityAt: null,
            now,
          })
        : null;

    // Distribution history list: same investor-wide source as the bars above,
    // so the list, the bars, and the header total all reconcile.
    const distributions: PortfolioDistribution[] = investorDistributions.map(
      (t) => ({
        id: t.id,
        amountUsdc: t.amountUsdc,
        paidAt: t.occurredAt,
        txHash: t.txHash,
        vaultName: t.vaultName,
      }),
    );

    return {
      hasPosition: true,
      kycStatus,
      shareClass,
      depositUsdc,
      currentValueUsdc,
      accruedUsdc,
      distributedUsdc,
      totalChangePct,
      apyLow,
      apyHigh,
      lockupDays,
      lockupElapsedDays,
      lockupRemainingDays,
      vaultCapacityUsdc,
      subscribedAt,
      nextDistributionAt: portfolio.nextDistributionAt,
      status: anchorPosition?.status ?? null,
      navPoints,
      yieldHistory,
      distributions,
      positions,
      source: portfolio.source,
      updatedAt: portfolio.updatedAt,
    };
  },
);
