"use client";

import Link from "next/link";

import { IdentityVendorPanel } from "@/components/onboarding/identity-vendor-panel";
import { IdentityStep } from "@/components/onboarding/identity-step";
import {
  OnboardingChamber,
  OnboardingChamberSole,
  useOnboardingShell,
} from "@/components/onboarding/onboarding-chamber";
import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

interface IdentityChamberProps {
  kycVendorReady: boolean;
  mayContinue: boolean;
  isProduction: boolean;
  /** Investor's real KYC state, or null when no investor row resolved yet. */
  kycStatus: "pending" | "approved" | "rejected" | string | null;
}

export function IdentityChamber({
  kycVendorReady,
  mayContinue,
  isProduction,
  kycStatus,
}: IdentityChamberProps) {
  const { irContact } = useOnboardingShell();

  // Honest, status-aware compliance copy — never claims a verdict the investor
  // doesn't hold. Pending → it's being reviewed; rejected → how to resubmit;
  // otherwise → the generic pre-submission note.
  const complianceCopy =
    kycStatus === "approved" ? (
      <>Your identity is verified. You can continue to wallet binding.</>
    ) : kycStatus === "pending" ? (
      <>
        Your documents are submitted and under review — this typically completes
        within 2 business days. You will be notified by email once a decision is
        made. No further action is needed right now.
      </>
    ) : kycStatus === "rejected" ? (
      <>
        Verification did not pass. Re-submit a valid government-issued ID above,
        or reach out to your investor-relations contact below to resolve it.
      </>
    ) : (
      <>
        KYC review typically completes within 24 hours. You will be notified by
        email once your identity has been verified.
      </>
    );

  return (
    <OnboardingChamber
      testId="onboarding-identity"
      crown={
        <>
          <StepProgressBar active="identity" />
          <div className="flex flex-col gap-1.5">
            <span className="ct-bento-label">Onboarding · Step 2 of 3</span>
            <h1 className="h1">
              Identity <span className="h1-accent">verification</span>
            </h1>
            <p className="body-sm m-0 text-pretty max-w-prose">
              AML / KYC verification is required prior to onboarding. The process
              takes approximately 3–5 minutes and requires a valid government-issued
              ID.
            </p>
          </div>
        </>
      }
      body={
        <>
          {kycVendorReady ? (
            <IdentityStep />
          ) : (
            <IdentityVendorPanel isProduction={isProduction} />
          )}
        </>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={complianceCopy}
          actions={
            <div className="flex flex-col gap-3">
              {mayContinue ? (
                <Button variant="primary" size="lg" asChild className="w-full">
                  <Link href="/onboarding/wallet">Continue to wallet binding</Link>
                </Button>
              ) : kycVendorReady ? (
                <p
                  className="ct-metric-caption m-0 text-center"
                  role="status"
                >
                  Launch identity verification above to continue.
                </p>
              ) : (
                // Sumsub not configured. In every environment (prod included)
                // we still offer an in-app way forward to the optional wallet
                // step — identity review is then completed manually by Investor
                // Relations (see the panel above). KYC stays `pending`; nothing
                // here approves it. Without this branch the production user is
                // trapped at step 2 with no path to wallet/portfolio.
                <Button variant="secondary" size="lg" asChild className="w-full">
                  <Link href="/onboarding/wallet">
                    Continue without identity verification
                  </Link>
                </Button>
              )}

              <Button variant="ghost" size="md" asChild className="w-full">
                <Link href="/onboarding/accreditation">← Back</Link>
              </Button>
            </div>
          }
        />
      }
    />
  );
}
