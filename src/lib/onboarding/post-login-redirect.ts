import "server-only";

import { prisma } from "@/lib/db";
import { safeFrom } from "@/lib/safe-redirect";

/**
 * resolvePostLoginRedirect
 *
 * Where a freshly-authenticated user should land.
 *
 * - If the user followed an explicit deep link (`from` is a real same-origin
 *   path, validated by `safeFrom`), honour it verbatim — they asked to go
 *   somewhere specific, so we never hijack that.
 * - Otherwise (the common "just signed in" case, no `from`), inspect the
 *   investor's onboarding state and route an un-onboarded investor into the
 *   funnel at `/onboarding/accreditation` instead of dropping them on an empty
 *   `/portfolio`. An investor who has already attested accreditation continues
 *   to the default `/portfolio` dashboard.
 *
 * "Un-onboarded" is keyed on `accreditationAttestedAt` — the single gate that
 * the onboarding layout enforces for every step past accreditation. KYC and
 * wallet are completed downstream (KYC is async; wallet is optional), so they
 * do not change the *entry* decision.
 *
 * Non-investor accounts (e.g. admins) and any DB hiccup fall back to the
 * default — they should never be pushed into the investor funnel.
 */
export async function resolvePostLoginRedirect(
  userId: string,
  from?: string,
): Promise<string> {
  // An explicit, validated deep link always wins.
  if (from && safeFrom(from, "") !== "") {
    return safeFrom(from);
  }

  try {
    const investor = await prisma.investor.findUnique({
      where: { userId },
      select: { accreditationAttestedAt: true },
    });

    // Only route *investors who have not yet entered onboarding* into the
    // funnel. No investor row (admin / not provisioned) → default.
    if (investor && investor.accreditationAttestedAt == null) {
      return "/onboarding/accreditation";
    }
  } catch {
    // Never block sign-in on an onboarding lookup — fall through to default.
  }

  return safeFrom(from);
}
