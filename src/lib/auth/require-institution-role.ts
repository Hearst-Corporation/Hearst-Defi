import "server-only";

import { getSession } from "./session";
import { prisma } from "@/lib/db";

/**
 * Asserts that the current request is authenticated AND holds one of
 * `allowedRoles` within the given `Institution` (Bitcoin Strategic Reserve
 * B2B2C, P3).
 *
 * Mirrors `require-admin.ts`'s shape and error style, but the role lives on
 * `InstitutionMember.role` (per-institution: owner|admin|finance|operator|
 * viewer|auditor) rather than on the platform-wide `User.role` gate.
 *
 * This is the APPLICATIVE owner-check — same convention as `require-admin.ts`
 * (no Postgres RLS in this schema). Every future institution-scoped query
 * MUST additionally filter `where: { institutionId }` itself; calling this
 * guard alone does not scope any subsequent Prisma query.
 *
 * Composite-key lookup: `InstitutionMember` declares
 * `@@unique([institutionId, userId])` with no explicit `name`, so Prisma
 * auto-generates the compound field as `institutionId_userId` (confirmed by
 * reading `prisma/schema.prisma` — no `@@unique(..., name: "...")` override
 * is present on that model).
 */
export async function requireInstitutionRole(
  institutionId: string,
  allowedRoles: readonly string[],
): Promise<{ userId: string; role: string }> {
  const session = await getSession();

  if (!session) {
    throw new Error("Authentication required.");
  }

  const membership = await prisma.institutionMember.findUnique({
    where: {
      institutionId_userId: {
        institutionId,
        userId: session.userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Not a member of this institution.");
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new Error("Insufficient institution role.");
  }

  return {
    userId: session.userId,
    role: membership.role,
  };
}
