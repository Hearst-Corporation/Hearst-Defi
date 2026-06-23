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

export type KycStatus = "pending" | "approved" | "rejected";

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
  /** Sum of principalUsdc across ALL the investor's positions, USDC. */
  totalPrincipalUsdc: number;
  /** Investor row creation date. */
  joinedAt: Date;
}

function normaliseKyc(status: string): KycStatus {
  if (status === "approved" || status === "rejected") return status;
  return "pending";
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
export async function loadCustomers(
  page: number = 1,
  pageSize: number = 50,
): Promise<PaginatedResult<CustomerRow>> {
  const ps = clampPageSize(pageSize);

  // Resolve the set of Investor.userId values that point to an existing User
  // FIRST, then use it in BOTH `count` and `findMany`. This guarantees the
  // header total and the rendered rows are derived from the same population —
  // no "Investors (3)" while only 2 rows render because one was an orphan.
  const validUserIds = (
    await prisma.user.findMany({
      where: { investor: { isNot: null } },
      select: { id: true },
    })
  ).map((u) => u.id);

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
      const activePositions = inv.positions.filter(
        (p) => p.status === "active",
      ).length;

      // Decimal → number at the boundary, summed across all positions.
      const totalPrincipalUsdc = inv.positions.reduce(
        (sum, p) => sum + p.principalUsdc.toNumber(),
        0,
      );

      return {
        id: inv.id,
        email: userById.get(inv.userId) ?? "—",
        walletAddress: inv.walletAddress,
        kycStatus: normaliseKyc(inv.kycStatus),
        activePositions,
        totalPrincipalUsdc,
        joinedAt: inv.createdAt,
      };
    });

  return toPaginatedResult(rows, total, page, ps);
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
  submittedAt: Date;
}

/**
 * Loads QualificationProfile rows that were submitted but never matched to a
 * User (userId IS NULL) — e.g. a Typeform submission whose auto-create threw and
 * was swallowed, or a form filled before the account existed. These are
 * operationally invisible everywhere else (they are not Investors, so they never
 * appear in the registry). Surfacing them lets an admin recover the lead instead
 * of losing the submission silently. Capped — this is a recovery list, not a CRM.
 */
export async function loadOrphanSubmissions(
  limit = 50,
): Promise<OrphanSubmissionRow[]> {
  const rows = await prisma.qualificationProfile.findMany({
    where: { userId: null },
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      source: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    source: r.source,
    submittedAt: r.updatedAt,
  }));
}
