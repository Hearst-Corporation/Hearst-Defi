import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Platform-wide aggregates for the admin dashboard KPI strip.
//
// - investorCount: registered investors (Investor rows linked to a live User),
//   same population logic as `loadCustomers` so the dashboard count matches the
//   customers table header (no orphan drift).
// - investedCapitalUsdc: sum of principalUsdc across ALL active positions held
//   by those valid investors — the real LP capital deployed (provenance manual,
//   it's a ledger record, not an on-chain read).
//
// Decimal → number happens here at the data boundary (mirrors dashboard.ts /
// customers.ts). Per-request cached via React `cache`.
// ---------------------------------------------------------------------------

export interface PlatformTotals {
  investorCount: number;
  investedCapitalUsdc: number;
}

export const loadPlatformTotals = cache(async (): Promise<PlatformTotals> => {
  // Valid population = investors whose linked User still exists (same gate as
  // loadCustomers), so counts/sums never include orphaned Investor rows.
  const validUserIds = (
    await prisma.user.findMany({
      where: { investor: { isNot: null } },
      select: { id: true },
    })
  ).map((u) => u.id);

  const whereInvestors = { userId: { in: validUserIds } };

  const [investorCount, principalAgg] = await Promise.all([
    prisma.investor.count({ where: whereInvestors }),
    prisma.position.aggregate({
      _sum: { principalUsdc: true },
      where: {
        status: "active",
        investor: { is: whereInvestors },
      },
    }),
  ]);

  return {
    investorCount,
    investedCapitalUsdc: principalAgg._sum.principalUsdc?.toNumber() ?? 0,
  };
});
