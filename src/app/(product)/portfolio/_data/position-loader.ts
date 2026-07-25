// /portfolio — the position loader (MONDE B: backend-only).
//
// The investor's own position, read from hearst-connect-backend over HTTP via
// `getDashboardFromBackend` (the per-user DTO aggregate). This REPLACES the old
// dual read path — the chain adapter (`readUserShares` / `readWhitelist`, viem)
// and the Prisma ledger (`loadPortfolio`) — so a business fact now has exactly
// one source, and it is the backend (endpoint-to-ui-matrix.md §A row 1).
//
// The DTO carries everything this page renders:
//   • position  → value, shares, deposits, withdrawals, subscribedAt, status;
//   • identity   → wallet, whitelist, share class;
//   • subscription → eligibility (whitelist-or-open);
//   • terms      → product duration (months);
//   • activity   → the contribution timeline, most-recent-first.
//
// ── The honesty rule (unchanged from the old page) ──────────────────────────
// Every absent field becomes an `unavailable` envelope carrying WHY, never a
// zero and never a fixture. A field the backend reports null stays null / not
// reported; a whole read that never answered is `unavailable` with a reason.
// A brand-new account with no position is NOT unavailable — the backend answers
// with a resolved-but-empty position (positionsCount 0), which the surface
// renders as an honest "no position yet", distinct from an outage.

import "server-only";

import { getDashboardFromBackend, isBackendError } from "@/lib/backend";
import {
  resolvedToWired,
  selectExposedFromWired,
  type WiredFromBackend,
} from "@/lib/backend/resolved-view";
import { logger } from "@/lib/logger";

/** One contribution-timeline entry, backend-shaped. */
export interface PositionActivityItem {
  readonly type: string;
  readonly amountUsdc: string;
  readonly occurredAt: string;
  readonly txHash: string | null;
}

/** The four flow kinds `RecentActivity` can render an icon + direction for. */
export type PortfolioFlowType = "deposit" | "claim" | "withdraw" | "distribution";

/**
 * Map the backend's open activity `type` onto the closed flow vocabulary the
 * timeline component draws. Deposit-side and redeem/withdraw-side are the only
 * two directions the ledger actually carries today; anything unrecognised is
 * shown as a deposit-side row rather than dropped — an activity we cannot
 * classify is still a real movement and must not vanish from the timeline. The
 * amount and date still render verbatim, so a mislabelled icon never misstates
 * a figure.
 */
export function toFlowType(backendType: string): PortfolioFlowType {
  const t = backendType.toLowerCase();
  if (t.includes("redeem") || t.includes("withdraw")) return "withdraw";
  if (t.includes("claim")) return "claim";
  if (t.includes("distribution")) return "distribution";
  return "deposit";
}

/** The investor's own position — the spine of the page.
 *
 *  IMPORTANT — these monetary fields are ALREADY-FORMATTED USDC DECIMAL STRINGS
 *  as the backend reports them (`InvestorPositionViewModel`: "USDC decimal
 *  string"), NOT atomic 6dp units. They render with a plain " USDC" suffix and
 *  must NEVER be passed through `formatUsdcAmount`/`BigInt` — that would divide
 *  an already-scaled figure by 10^6 (the same $250,000 → $0.25 class of bug the
 *  backend fix at 7cf84d9 closed for the minimum ticket). `shares` is a plain
 *  share-count string, rendered as-is. A null field stays null → "not
 *  reported", never a fabricated 0. */
export interface MyPositionHoldings {
  readonly value: string | null;
  readonly principal: string | null;
  readonly deposits: string | null;
  readonly withdrawals: string | null;
  readonly shares: string | null;
  readonly positionsCount: number;
  readonly subscribedAt: string | null;
  readonly status: string | null;
}

/** Identity + eligibility facts spliced onto the position. */
export interface MyPositionEligibility {
  readonly whitelisted: boolean | null;
  readonly whitelistRequired: boolean;
  readonly userEligible: boolean | null;
  readonly walletAddress: string | null;
  readonly shareClass: "A" | "B" | null;
}

/** One allocation pocket (B1/B2/B3), target and actual bps. Feeds the
 *  "Strategy composition" donut. `actualBps` is null until the on-chain split
 *  is indexed — the donut then shows the product TARGET, labelled as such. */
export interface MyPositionPocket {
  readonly pocket: "B1" | "B2" | "B3";
  readonly label: string;
  readonly targetBps: number;
  readonly actualBps: number | null;
}

/** Programme-level capacity — committed vs available vs cap. All ALREADY-
 *  FORMATTED USDC decimal strings (same rule as holdings), null when absent.
 *  Feeds the "Capacity mix" donut. */
export interface MyPositionCapacity {
  readonly committed: string | null;
  readonly available: string | null;
  readonly cap: string | null;
  readonly utilizationBps: number | null;
}

export interface MyPositionData {
  /** Position holdings — the KPI hero + Holdings panel read this. */
  readonly holdings: WiredFromBackend<MyPositionHoldings>;
  /** Eligibility — the Eligibility panel + Subscription KPI read this. */
  readonly eligibility: WiredFromBackend<MyPositionEligibility>;
  /** Product term in months — the Term KPI + maturity section read this. */
  readonly termMonths: WiredFromBackend<number>;
  /** Strategy allocation pockets (B1/B2/B3) — feeds the composition donut. */
  readonly allocation: WiredFromBackend<readonly MyPositionPocket[]>;
  /** Programme capacity (committed / available / cap) — feeds the capacity donut. */
  readonly capacity: WiredFromBackend<MyPositionCapacity>;
  /** Contribution timeline, most-recent-first. Empty = honest empty state. */
  readonly activity: readonly PositionActivityItem[];
  /** True once a resolved position with any share balance exists. Drives the
   *  page's "no position" affordance (the "View Series 1 →" CTA). */
  readonly hasPosition: boolean;
  /** Backend runtime mode, for the page meta line (e.g. "v2-fork"). */
  readonly runtimeMode: string;
  /** Distinguishes "we couldn't reach the data at all" from per-field absence:
   *  when the whole dashboard read failed, the page shows an honest outage line
   *  rather than an empty position. */
  readonly reachable: boolean;
}

/**
 * Load the investor's position for /portfolio.
 *
 * ONE authenticated backend call. A transport failure does not throw here —
 * it degrades every block to `unavailable` with a reason and flips `reachable`
 * to false, so the page renders an honest "couldn't reach the data" state
 * instead of a zero position or a crash.
 */
export async function loadMyPosition(): Promise<MyPositionData> {
  let dto: Awaited<ReturnType<typeof getDashboardFromBackend>>["data"] | null = null;
  try {
    const envelope = await getDashboardFromBackend();
    dto = envelope.data;
  } catch (e: unknown) {
    const detail = isBackendError(e)
      ? `${e.code}${e.status !== null ? ` ${e.status}` : ""} on ${e.path} (request ${e.requestId})`
      : e instanceof Error
        ? e.message
        : "unknown error";
    logger.warn("portfolio: backend dashboard read failed", { detail });
  }

  // Whole read never answered → every block unavailable, page shows an outage.
  if (dto === null) {
    const down: WiredFromBackend<never> = {
      status: "unavailable",
      reason: "backend:unreachable",
    };
    return {
      holdings: down,
      eligibility: down,
      termMonths: down,
      allocation: down,
      capacity: down,
      activity: [],
      hasPosition: false,
      runtimeMode: "not_configured",
      reachable: false,
    };
  }

  const runtime = dto.runtime;

  // ── Holdings — the position block is the spine. A null-valued block stays
  // unavailable with its own reason (backend contradicting itself, or nothing
  // subscribed yet), never a fabricated position.
  const holdings: WiredFromBackend<MyPositionHoldings> = selectExposedFromWired(
    resolvedToWired(dto.position, runtime),
    (p) => ({
      value: p.value,
      principal: p.principal,
      deposits: p.deposits,
      withdrawals: p.withdrawals,
      shares: p.shares,
      positionsCount: p.positionsCount,
      subscribedAt: p.subscribedAt,
      status: p.status,
    }),
  );

  // ── Eligibility — identity (whitelist/wallet/class) merged with the
  // subscription summary (userEligible/whitelistRequired). Available whenever
  // EITHER answers; a field the other did not report stays null.
  const identityW = resolvedToWired(dto.identity, runtime);
  const subscriptionW = resolvedToWired(dto.subscription, runtime);
  const eligibility: WiredFromBackend<MyPositionEligibility> =
    identityW.status === "wired" || subscriptionW.status === "wired"
      ? {
          status: "wired",
          source: "v2",
          address: runtime.contractAddress ?? "",
          chainId: runtime.chainId ?? 0,
          readAt: new Date().toISOString(),
          data: {
            whitelisted: identityW.status === "wired" ? identityW.data.whitelisted : null,
            whitelistRequired:
              subscriptionW.status === "wired" ? subscriptionW.data.whitelistRequired : false,
            userEligible: subscriptionW.status === "wired" ? subscriptionW.data.userEligible : null,
            walletAddress: identityW.status === "wired" ? identityW.data.walletAddress : null,
            shareClass: identityW.status === "wired" ? identityW.data.shareClass : null,
          },
        }
      : // Neither block answered — carry identity's reason (the primary source).
        identityW;

  // ── Term — product duration in months. On the DashboardDTO this rides on the
  // `vault` snapshot block (`productDurationMonths`), not a standalone terms
  // block. Null until the on-chain duration resolves → "not reported".
  const termMonths: WiredFromBackend<number> = selectExposedFromWired(
    resolvedToWired(dto.vault, runtime),
    (v) => v.productDurationMonths,
  );

  // ── Activity — the contribution timeline. An unavailable read yields [] and
  // the surface shows the same honest empty state; rows are never invented.
  const activityW = resolvedToWired(dto.activity, runtime);
  const activity: readonly PositionActivityItem[] =
    activityW.status === "wired"
      ? activityW.data.map((a) => ({
          type: a.type,
          amountUsdc: a.amountUsdc,
          occurredAt: a.occurredAt,
          txHash: a.txHash,
        }))
      : [];

  // ── Allocation — the B1/B2/B3 pockets. Feeds the composition donut. An
  // unavailable read renders the donut's honest empty state, never fake pockets.
  const allocation: WiredFromBackend<readonly MyPositionPocket[]> = selectExposedFromWired(
    resolvedToWired(dto.allocation, runtime),
    (a) =>
      a.pockets.map((p) => ({
        pocket: p.pocket,
        label: p.label,
        targetBps: p.targetBps,
        actualBps: p.actualBps,
      })),
  );

  // ── Capacity — committed / available / cap (already-formatted USDC strings).
  // Feeds the capacity-mix donut. Utilization is a bps integer or null.
  const capacity: WiredFromBackend<MyPositionCapacity> = selectExposedFromWired(
    resolvedToWired(dto.capacity, runtime),
    (c) => ({
      committed: c.totalAssets,
      available: c.availableCapacity,
      cap: c.tvlCap,
      utilizationBps: c.utilizationBps,
    }),
  );

  const hasPosition =
    holdings.status === "wired" &&
    holdings.data.shares !== null &&
    // A resolved share string that is neither empty nor a pure-zero balance.
    /[1-9]/.test(holdings.data.shares);

  return {
    holdings,
    eligibility,
    termMonths,
    allocation,
    capacity,
    activity,
    hasPosition,
    runtimeMode: runtime.mode,
    reachable: true,
  };
}
