import Image from "next/image";
import type { ReactNode } from "react";

import {
  OnboardingShellProvider,
} from "@/components/onboarding/onboarding-chamber";
import { OnboardingChecklistRail } from "@/components/onboarding/onboarding-checklist-rail";
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
      <div
        className="dark flex min-h-screen w-full justify-center bg-black px-4 py-10 sm:px-6 lg:py-16"
        data-testid="onboarding-shell"
      >
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <header className="flex justify-center">
            <Image
              src="/logos/hearst-connect-dark.svg"
              alt="Hearst Connect"
              width={160}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </header>

          {state.checklist.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black p-5 shadow-sm">
              <OnboardingChecklistRail items={state.checklist} />
            </div>
          )}

          <div className="product-doc product-doc-shell flex flex-col gap-y-5">
            {children}
          </div>
        </div>
      </div>
    </OnboardingShellProvider>
  );
}
