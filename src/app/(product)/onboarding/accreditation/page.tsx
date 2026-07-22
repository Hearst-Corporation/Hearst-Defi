/**
 * Step 1 — Accreditation attestations (Rule 506(c) + Cayman PIF).
 */

"use client";

import { useRouter } from "next/navigation";

import {
  AccreditationAttestationFields,
  useAccreditationAttestations,
} from "@/components/onboarding/accreditation-attestations";
import {
  OnboardingChamber,
  OnboardingChamberSole,
  useOnboardingShell,
} from "@/components/onboarding/onboarding-chamber";
import { StepProgressBar } from "@/components/onboarding/StepProgressBar";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

export default function AccreditationPage() {
  const router = useRouter();
  const { irContact } = useOnboardingShell();
  const attestation = useAccreditationAttestations(() => {
    router.push("/onboarding/identity");
  });

  return (
    <OnboardingChamber
      testId="onboarding-accreditation"
      crown={
        <>
          <StepProgressBar active="accreditation" />
          <div className="flex flex-col gap-2">
            <p className="ct-bento-label">Onboarding · Step 1 of 3</p>
            <h1 className="h1">Investor accreditation</h1>
            <p className="body-sm text-pretty">
              The Hearst Bitcoin Reserve Vault is offered exclusively to accredited investors
              under SEC Rule 506(c) and eligible participants under Cayman
              Islands law. Please confirm each statement below.
            </p>
          </div>
        </>
      }
      body={
        <AccreditationAttestationFields state={attestation} />
      }
      sole={
        <OnboardingChamberSole
          irContact={irContact}
          compliance={
            <>
              False attestation may result in immediate termination of
              participation. This is not a solicitation of investment.
            </>
          }
          actions={
            <Button
              variant="primary"
              size="lg"
              disabled={!attestation.allChecked || attestation.isPending}
              aria-disabled={!attestation.allChecked || attestation.isPending}
              onClick={attestation.handleContinue}
              className="w-full"
            >
              {attestation.isPending ? "Confirming…" : "Continue"}
            </Button>
          }
        />
      }
    />
  );
}
