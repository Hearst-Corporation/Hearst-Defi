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
import { Button } from "@/components/ui/button";

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
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Onboarding · Step 1 of 3
            </p>
            <h1 className="text-[22px] font-medium text-white leading-none tracking-tight">
              Investor accreditation
            </h1>
            <p className="text-[13px] text-zinc-400 leading-relaxed text-pretty">
              Hearst Yield Vault is offered exclusively to accredited investors
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
