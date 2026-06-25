import "server-only";
import { prisma } from "@/lib/db";

/**
 * Returns a Prisma `where` clause that filters for "valid" investors:
 * those whose linked User still exists. This prevents including orphaned
 * Investor rows in platform-wide counts and sums.
 */
export async function getValidInvestorWhere() {
  const validUserIds = (
    await prisma.user.findMany({
      where: { investor: { isNot: null } },
      select: { id: true },
    })
  ).map((u) => u.id);

  return { userId: { in: validUserIds } };
}
