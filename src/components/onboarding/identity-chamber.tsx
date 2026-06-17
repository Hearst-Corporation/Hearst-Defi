"use client";

import Link from "next/link";

import { IdentityVendorPanel } from "@/components/onboarding/identity-vendor-panel";
import { IdentityStep } from "@/components/onboarding/identity-step";
import {
  OnboardingChamber,
  OnboardingChamberSole,
  OnboardingRequirementsList,
  useOnboardingShell,
} from "@/components/onboarding/onboarding-chamber";
import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { Button } from "@/components/ui/button";

interface IdentityChamberProps {
  personaReady: boolean;
  templateId: string;
  environment: "sandbox" | "production";
  referenceId?: string;
  mayContinue: boolean;
  isProduction: boolean;
}

export function IdentityChamber({
  personaReady,
  templateId,
  environment,
  referenceId,
  mayContinue,
  isProduction,
}: IdentityChamberProps) {
  const { checklist, irContact } = useOnboardingShell();

  return (
    <OnboardingChamber
      testId="onboarding-identity"
      crown={
        <>
          <StepProgressBar active="identity" />
          <div className="product-doc-stack--tight">
            <p className="eyebrow ct-text-muted m-0">Onboarding · Step 2 of 3</p>
            <h1 className="h1 m-0">Identity verification</h1>
            <p className="body-md ct-text-muted m-0 text-pretty ct-prose-lg">
              AML / KYC verification is required prior to onboarding. The process
              takes approximately 3–5 minutes and requires a valid government-issued
              ID.
            </p>
          </div>
        </>
      }
      body={
        <>
          <OnboardingRequirementsList items={checklist} />
          {personaReady ? (
            <IdentityStep
              templateId={templateId}
              environment={environment}
              referenceId={referenceId}
            />
          ) : (
            <IdentityVendorPanel isProduction={isProduction} />
          )}
        </>
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={
            <>
              KYC review typically completes within 24 hours. You will be notified
              by email once your identity has been verified.
            </>
          }
          actions={
            <div className="product-doc-stack--actions">
              {mayContinue ? (
                <Button variant="primary" size="lg" asChild className="w-full">
                  <Link href="/onboarding/wallet">Continue to wallet binding</Link>
                </Button>
              ) : personaReady ? (
                <p className="body-xs ct-text-faint m-0 text-center" role="status">
                  Launch identity verification above to continue.
                </p>
              ) : !isProduction ? (
                <Button variant="secondary" size="lg" asChild className="w-full">
                  <Link href="/onboarding/wallet">
                    Continue
                  </Link>
                </Button>
              ) : null}

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
