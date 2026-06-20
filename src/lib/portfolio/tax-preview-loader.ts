import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";
import { daysHeldSince } from "@/lib/engine/lp-pnl";
import { getTaxPreview, type TaxPreview } from "@/lib/portfolio/tax";

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

/**
 * Tax preview wired to real investor ledger data when available.
 * Still docStatus "preview" — not a filed tax document.
 */
export const loadTaxPreview = cache(
  async (year: number = new Date().getUTCFullYear()): Promise<TaxPreview | null> => {
    const investor = await getInvestor();
    if (!investor) return null;

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [positions, ytdPayoutTxs] = await Promise.all([
      prisma.position.findMany({
        where: { investorId: investor.id },
        orderBy: { subscribedAt: "asc" },
        take: 100,
      }),
      prisma.investorTransaction.findMany({
        where: {
          investorId: investor.id,
          type: { in: ["claim", "distribution"] },
          occurredAt: { gte: yearStart, lt: yearEnd },
        },
        select: { amountUsdc: true },
        take: 500,
      }),
    ]);

    const actualPrincipalUsd = positions.reduce(
      (sum, p) => sum + toNumber(p.principalUsdc),
      0,
    );
    const actualAccruedYieldUsd = positions.reduce(
      (sum, p) => sum + toNumber(p.accruedYieldUsdc),
      0,
    );
    const actualInterestIncomeUsd = ytdPayoutTxs.reduce(
      (sum, t) => sum + toNumber(t.amountUsdc),
      0,
    );

    const oldest = positions[0]?.subscribedAt;
    const actualDaysHeld = oldest ? daysHeldSince(oldest, new Date()) : 0;

    return getTaxPreview(investor.id, year, {
      actualInterestIncomeUsd,
      actualPrincipalUsd,
      actualAccruedYieldUsd,
      actualDaysHeld,
    });
  },
);
