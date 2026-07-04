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
import { cn } from "@/lib/cn";

interface IdentityChamberProps {
  kycVendorReady: boolean;
  mayContinue: boolean;
  isProduction: boolean;
  /** Investor's real KYC state, or null when no investor row resolved yet. */
  kycStatus: "pending" | "approved" | "rejected" | string | null;
  /** Demo-only shortcut controls, rendered in the sole. Null for real accounts. */
  demoTools?: React.ReactNode;
}

export function IdentityChamber({
  kycVendorReady,
  mayContinue,
  isProduction,
  kycStatus,
  demoTools,
}: IdentityChamberProps) {
  const { irContact } = useOnboardingShell();

  // A submission is already on file (submitted, in review, or verified) — the
  // upload form must NOT re-render, or it contradicts the "already submitted"
  // copy in the sole. Only `null` (nothing yet) and `rejected` (resubmit) show
  // the live form.
  const submissionOnFile = kycStatus === "pending" || kycStatus === "approved";

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
          {submissionOnFile ? (
            <IdentitySubmittedPanel verified={kycStatus === "approved"} />
          ) : kycVendorReady ? (
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
              ) : kycVendorReady && kycStatus == null ? (
                <p
                  className="ct-metric-caption m-0 text-center"
                  role="status"
                >
                  Launch identity verification above to continue.
                </p>
              ) : kycVendorReady ? null : (
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

              {demoTools}
            </div>
          }
        />
      }
    />
  );
}

/**
 * Read-only status panel shown in place of the upload form once a document is
 * already on file — either in review (`pending`) or cleared (`approved`).
 * Prevents a live "Submit for verification" form from contradicting the
 * "already submitted / verified" copy rendered in the sole.
 */
function IdentitySubmittedPanel({ verified }: { verified: boolean }) {
  return (
    <div
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
      role="region"
      aria-label="Identity verification status"
    >
      <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-center justify-between gap-4">
        <h2 className="ct-bento-label">Identity document</h2>
        <span
          className={cn(
            "ct-bento-label inline-flex items-center rounded-full px-2.5 py-0.5",
            verified ? "ct-status-success-bg" : "ct-status-warning-bg",
          )}
        >
          {verified ? "Verified" : "In review"}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-2" role="note">
        <p className="body-sm m-0 ct-text-strong">
          {verified
            ? "Your identity has been verified."
            : "Your document has been submitted."}
        </p>
        <p className="body-xs m-0">
          {verified
            ? "You can continue to wallet binding below."
            : "It is now under review — no further action is needed. You will be notified by email once a decision is made."}
        </p>
      </div>
    </div>
  );
}
