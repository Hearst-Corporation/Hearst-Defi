"use server";

import { prisma } from "@/lib/db";
import { getInvestor } from "@/lib/auth/session";

/**
 * AttestAccreditationResult — discriminated union returned by attestAccreditation.
 */
export type AttestAccreditationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * attestAccreditation
 *
 * Server Action: records that the currently authenticated investor has attested
 * their accreditation status by writing `accreditationAttestedAt = now()` on
 * their Investor row.
 *
 * Idempotent: calling it multiple times simply overwrites the timestamp with
 * the most recent attestation date (re-attestation is acceptable behaviour).
 *
 * Usage (from accreditation attestations flow or any client component):
 *   import { attestAccreditation } from "@/app/actions/accreditation";
 *   const result = await attestAccreditation();
 *   if (!result.ok) { ... }
 */
export async function attestAccreditation(): Promise<AttestAccreditationResult> {
  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }

  await prisma.investor.update({
    where: { id: investor.id },
    data: { accreditationAttestedAt: new Date() },
  });

  return { ok: true };
}
