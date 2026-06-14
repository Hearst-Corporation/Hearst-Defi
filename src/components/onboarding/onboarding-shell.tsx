import Image from "next/image";
import type { ReactNode } from "react";

import {
  OnboardingShellProvider,
} from "@/components/onboarding/onboarding-chamber";
import type { IrContact } from "@/lib/ir-contact";
import type { OnboardingState, OnboardingStepId } from "@/lib/onboarding/state";

interface OnboardingShellProps {
  activeStep: OnboardingStepId;
  state: OnboardingState;
  irContact: IrContact | null;
  children: ReactNode;
}

export function OnboardingShell({
  activeStep: _activeStep,
  state,
  irContact,
  children,
}: OnboardingShellProps) {
  return (
    <OnboardingShellProvider
      checklist={state.checklist}
      irContact={irContact}
    >
      <div className="onboarding-shell" data-testid="onboarding-shell">
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

          <div className="onboarding-shell__stage product-doc product-doc-shell">
            {children}
          </div>
        </div>
      </div>
    </OnboardingShellProvider>
  );
}
