/**
 * Onboarding layout — bare funnel shell (no product rails).
 * Progress + checklist driven by pathname and live investor state.
 */

import "./onboarding.css";
import "../product-doc.css";

import { headers } from "next/headers";
import type { ReactNode } from "react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { getIrContact } from "@/lib/ir-contact";
import { getInvestor, getSession } from "@/lib/auth/session";
import { listVaults } from "@/lib/data/vaults";
import { requireAccreditationAttested } from "@/lib/onboarding/gates";
import { investorHasKycInquiry } from "@/lib/onboarding/kyc-gate";
import {
  onboardingStepFromPathname,
  resolveOnboardingState,
} from "@/lib/onboarding/state";

export const metadata = {
  title: "Onboarding — Hearst Yield Vault",
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

  const vaults = state.accreditationAttested ? await listVaults() : [];
  const vault = vaults.find((v) => v.ticker === "HYV-A") ?? vaults[0] ?? null;

  const irContact = getIrContact();

  return (
    <OnboardingShell
      activeStep={activeStep}
      state={state}
      vault={vault}
      irContact={irContact}
    >
      {children}
    </OnboardingShell>
  );
}
