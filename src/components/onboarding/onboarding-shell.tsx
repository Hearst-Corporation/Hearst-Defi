import Image from "next/image";
import type { ReactNode } from "react";

import { OnboardingShellProvider } from "@/components/onboarding/onboarding-chamber";
import { OnboardingLegacyStepBridge } from "@/components/onboarding/onboarding-context-rail";
import type { IrContact } from "@/lib/ir-contact";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding/state";
import type { VaultProduct } from "@/lib/data/vaults";

interface OnboardingShellProps {
  activeStep: OnboardingStepId;
  state: OnboardingState;
  vault: VaultProduct | null;
  irContact: IrContact | null;
  children: ReactNode;
}

export function OnboardingShell({
  activeStep,
  state,
  vault: _vault,
  irContact,
  children,
}: OnboardingShellProps) {
  const isChamberStep = activeStep === "accreditation";

  return (
    <OnboardingShellProvider
      checklist={state.checklist}
      irContact={irContact}
    >
      <div className="onboarding-shell" data-testid="onboarding-shell">
        <div aria-hidden className="onboarding-shell__ambient" />

        <div className="onboarding-shell__frame">
          <header className="onboarding-shell__header">
            <Image
              src="/logos/hearst-connect-dark.svg"
              alt="Hearst Connect"
              width={160}
              height={48}
              className="onboarding-shell__logo"
              priority
            />
          </header>

          <div className="onboarding-shell__stage product-doc">
            {isChamberStep ? (
              children
            ) : (
              <OnboardingLegacyStepBridge activeStep={activeStep}>
                {children}
              </OnboardingLegacyStepBridge>
            )}
          </div>
        </div>
      </div>
    </OnboardingShellProvider>
  );
}
