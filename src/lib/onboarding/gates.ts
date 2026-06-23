import "server-only";

import type { Investor } from "@prisma/client";
import { redirect } from "next/navigation";

import { getInvestor } from "@/lib/auth/session";
import { isSumsubConfigured } from "@/lib/onboarding/config";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";

/**
 * Redirect when accreditation has not been attested (onboarding steps 2+).
 * Returns the attested investor so downstream gates can reuse its `userId`
 * without a second session/DB round-trip.
 */
export async function requireAccreditationAttested(
  redirectTo = "/onboarding/accreditation",
): Promise<Investor> {
  const investor = await getInvestor();
  if (!investor?.accreditationAttestedAt) {
    redirect(redirectTo);
  }
  return investor;
}

/**
 * Wallet step — accreditation + (when Sumsub is on) a claimed KycInquiry.
 *
 * The session is already proven by `requireAccreditationAttested()` (an attested
 * investor cannot exist without a valid session, and `getSession` is request-cached),
 * so we reuse its `userId` instead of re-checking the session here. That removes a
 * latent inconsistency: a mid-funnel `/login` bounce that could only fire on an
 * impossible session-vanishes-within-one-request race.
 */
export async function requireWalletStepAccess(): Promise<
  "ok" | "db_unavailable"
> {
  const investor = await requireAccreditationAttested();

  if (!isSumsubConfigured()) {
    return "ok";
  }

  const gate = await resolveKycWalletGate(investor.userId);
  if (gate === "requires_identity") {
    redirect("/onboarding/identity");
  }
  if (gate === "db_unavailable") {
    return "db_unavailable";
  }

  return "ok";
}

/**
 * True when the investor may leave the identity step for wallet binding.
 */
export async function canProceedToWallet(userId: string): Promise<boolean> {
  if (!isSumsubConfigured()) {
    return process.env.NODE_ENV !== "production";
  }

  const gate = await resolveKycWalletGate(userId);
  return gate === "passed" || gate === "gate_skipped";
}
