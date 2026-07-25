import "server-only";

import { prisma } from "@/lib/db";
import {
  clampPageSize,
  toPrismaSkip,
  toPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
// ---------------------------------------------------------------------------
// Customers supervision contract.
//
// Aggregated investor list consumed by `src/app/admin/customers/page.tsx`.
// Decimal → number happens here at the data boundary so the UI never sees
// Prisma.Decimal (mirrors the pattern in `src/lib/data/dashboard.ts`).
// ---------------------------------------------------------------------------

export type KycStatus = "pending" | "approved" | "rejected" | "unknown";

export interface CustomerRow {
  /** Investor.id (cuid). */
  id: string;
  /** Auth identity email (User.email). */
  email: string;
  /** Connected payment wallet, or null until one is linked. */
  walletAddress: string | null;
  kycStatus: KycStatus;
  /** Number of positions with status === "active". */
  activePositions: number;
  /** Sum of principalUsdc across the investor's ACTIVE positions only, USDC. */
  activePrincipalUsdc: number;
  /** Sum of principalUsdc across ALL positions (matured/exited included), USDC. */
  totalPrincipalUsdc: number;
  /** Investor row creation date. */
  joinedAt: Date;
}

/**
 * Honesty rule: a KYC status the app does not recognise is reported as
 * "unknown" — NEVER silently requalified to "pending" (a corrupt/unexpected
 * value is a data-quality fact the operator must see, not a review queue item).
 */
function normaliseKyc(status: string): KycStatus {
  if (status === "approved" || status === "rejected" || status === "pending") {
    return status;
  }
  return "unknown";
}

/**
 * Loads investors with their auth user + positions for the admin customers
 * table. Never throws on empty data — returns empty paginated result.
 *
 * Uses a manual batch join instead of Prisma's `include: { user }` to handle
 * orphaned Investor rows (userId references a deleted/missing User). Prisma
 * throws "Field user is required, got null" on those rows; fetching users
 * separately and filtering lets us skip orphans without crashing.
 */
/**
 * Resolves the Investor.userId values that point to an existing User. Used by
 * BOTH the page query and the aggregates so every number on the screen is
 * derived from the same population (orphaned Investor rows excluded everywhere).
 */
async function validInvestorUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { investor: { isNot: null } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function loadCustomers(
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<CustomerRow>> {
  const ps = clampPageSize(pageSize);

  // Resolve the set of Investor.userId values that point to an existing User
  // FIRST, then use it in BOTH `count` and `findMany`. This guarantees the
  // header total and the rendered rows are derived from the same population —
  // no "Investors (3)" while only 2 rows render because one was an orphan.
  const validUserIds = await validInvestorUserIds();

  const whereCustomers = { userId: { in: validUserIds } };

  const [investors, total] = await Promise.all([
    prisma.investor.findMany({
      where: whereCustomers,
      orderBy: { createdAt: "desc" },
      include: {
        positions: { select: { status: true, principalUsdc: true } },
      },
      skip: toPrismaSkip(page, ps),
      take: ps,
    }),
    prisma.investor.count({ where: whereCustomers }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: investors.map((inv) => inv.userId) } },
    select: { id: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u.email]));

  const rows = investors.map((inv) => {
      const active = inv.positions.filter((p) => p.status === "active");

      // Decimal → number at the boundary. Two distinct sums, named for what
      // they are: capital currently at work (active) vs lifetime total (all
      // positions, matured/exited included) — never one presented as the other.
      const activePrincipalUsdc = active.reduce(
        (sum, p) => sum + p.principalUsdc.toNumber(),
        0,
      );
      const totalPrincipalUsdc = inv.positions.reduce(
        (sum, p) => sum + p.principalUsdc.toNumber(),
        0,
      );

      return {
        id: inv.id,
        email: userById.get(inv.userId) ?? "—",
        walletAddress: inv.walletAddress,
        kycStatus: normaliseKyc(inv.kycStatus),
        activePositions: active.length,
        activePrincipalUsdc,
        totalPrincipalUsdc,
        joinedAt: inv.createdAt,
      };
    });

  return toPaginatedResult(rows, total, page, ps);
}

// ---------------------------------------------------------------------------
// Whole-population aggregates (KPI strip) — NEVER derived from the page window.
// ---------------------------------------------------------------------------

export interface CustomersAggregates {
  /** Count of the FULL valid-investor population (not the page window). */
  total: number;
  /** KYC breakdown over the full population; unrecognised values land in `unknown`. */
  kycCounts: Record<KycStatus, number>;
  /** Σ principalUsdc over ACTIVE positions of the full population, USDC. */
  activePrincipalUsdc: number;
  /** Investors (full population) holding at least one active position. */
  investorsWithActivePositions: number;
}

/**
 * Real aggregates for the customers KPI strip — Prisma count/groupBy/aggregate
 * over the FULL population, so the strip never presents a 50-row page window
 * as the investor base. Same orphan gate as loadCustomers().
 */
export async function loadCustomersAggregates(): Promise<CustomersAggregates> {
  const validUserIds = await validInvestorUserIds();
  const whereCustomers = { userId: { in: validUserIds } };

  const [total, kycGroups, activeSum, investorsWithActivePositions] =
    await Promise.all([
      prisma.investor.count({ where: whereCustomers }),
      prisma.investor.groupBy({
        by: ["kycStatus"],
        where: whereCustomers,
        _count: { _all: true },
      }),
      prisma.position.aggregate({
        where: {
          status: "active",
          investor: { userId: { in: validUserIds } },
        },
        _sum: { principalUsdc: true },
      }),
      prisma.investor.count({
        where: { ...whereCustomers, positions: { some: { status: "active" } } },
      }),
    ]);

  const kycCounts: Record<KycStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    unknown: 0,
  };
  for (const group of kycGroups) {
    kycCounts[normaliseKyc(group.kycStatus)] += group._count._all;
  }

  return {
    total,
    kycCounts,
    activePrincipalUsdc: activeSum._sum.principalUsdc?.toNumber() ?? 0,
    investorsWithActivePositions,
  };
}

// ---------------------------------------------------------------------------
// Orphan qualification submissions (lead capture, no account yet).
// ---------------------------------------------------------------------------

export interface OrphanSubmissionRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  source: string;
  /** REAL submission date (QualificationProfile.submittedAt), not updatedAt. */
  submittedAt: Date;
}

export interface OrphanSubmissions {
  rows: OrphanSubmissionRow[];
  /** Full count of unmatched submissions — `rows` may be capped below this. */
  total: number;
}

/**
 * Loads QualificationProfile rows that were submitted but never matched to a
 * User (userId IS NULL) — e.g. a Typeform submission whose auto-create threw and
 * was swallowed, or a form filled before the account existed. These are
 * operationally invisible everywhere else (they are not Investors, so they never
 * appear in the registry). Surfacing them lets an admin recover the lead instead
 * of losing the submission silently. Capped — this is a recovery list, not a
 * CRM — and the cap is DECLARED: `total` carries the real count so the view can
 * say "Showing X of Y". Dates are the REAL `submittedAt` column (the previous
 * version silently renamed `updatedAt` into "submitted").
 */
export async function loadOrphanSubmissions(
  limit = 50,
): Promise<OrphanSubmissions> {
  const where = { userId: null };
  const [rows, total] = await Promise.all([
    prisma.qualificationProfile.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        source: true,
        submittedAt: true,
      },
    }),
    prisma.qualificationProfile.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      source: r.source,
      submittedAt: r.submittedAt,
    })),
    total,
  };
}
