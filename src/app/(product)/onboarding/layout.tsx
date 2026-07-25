import { headers } from "next/headers";
import type { ReactNode } from "react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getIrContact } from "@/lib/ir-contact";
import { getInvestor, getSession } from "@/lib/auth/session";
import { requireAccreditationAttested } from "@/lib/onboarding/gates";
import { investorHasKycInquiry } from "@/lib/onboarding/kyc-gate";
import {
  onboardingStepFromPathname,
  resolveOnboardingState,
} from "@/lib/onboarding/state";

export const metadata = {
  title: "Onboarding — Hearst Bitcoin Reserve Vault",
};

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "/onboarding/accreditation";
  const activeStep = onboardingStepFromPathname(pathname);

  const [investor, session] = await Promise.all([getInvestor(), getSession()]);

  const hasKycInquiry =
    session?.userId != null
      ? await investorHasKycInquiry(session.userId)
      : false;

  const state = resolveOnboardingState(investor, hasKycInquiry);

  if (activeStep === "identity" || activeStep === "wallet") {
    await requireAccreditationAttested();
  }

  const irContact = getIrContact();

  return (
    <OnboardingShell
      activeStep={activeStep}
      state={state}
      irContact={irContact}
    >
      {children}
    </OnboardingShell>
  );
}
