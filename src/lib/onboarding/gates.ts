import "server-only";

import { redirect } from "next/navigation";

import { getInvestor, getSession } from "@/lib/auth/session";
import { isPersonaConfigured } from "@/lib/onboarding/config";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";

/**
 * Redirect when accreditation has not been attested (onboarding steps 2+).
 */
export async function requireAccreditationAttested(
  redirectTo = "/onboarding/accreditation",
): Promise<void> {
  const investor = await getInvestor();
  if (!investor?.accreditationAttestedAt) {
    redirect(redirectTo);
  }
}

/**
 * Wallet step — accreditation + (when Persona is on) a claimed KycInquiry.
 */
export async function requireWalletStepAccess(): Promise<
  "ok" | "db_unavailable"
> {
  await requireAccreditationAttested();

  if (!isPersonaConfigured()) {
    return "ok";
  }

  const session = await getSession();
  if (!session?.userId) {
    redirect("/login?from=%2Fonboarding%2Fwallet");
  }

  const gate = await resolveKycWalletGate(session.userId);
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
  if (!isPersonaConfigured()) {
    return process.env.NODE_ENV !== "production";
  }

  const gate = await resolveKycWalletGate(userId);
  return gate === "passed" || gate === "gate_skipped";
}
