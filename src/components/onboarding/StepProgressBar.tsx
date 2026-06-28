/**
 * Onboarding step indicator — 3 steps, route-driven active id.
 */

import {
  WizardStepProgress,
  type WizardStep,
} from "@/components/catalyst/wizard-step-progress";
import type { OnboardingStepId } from "@/lib/onboarding/state";

const STEPS: readonly WizardStep<OnboardingStepId>[] = [
  { id: "accreditation", label: "Accreditation", index: 1 },
  { id: "identity", label: "Identity", index: 2 },
  { id: "wallet", label: "Wallet", index: 3 },
] as const;

interface StepProgressBarProps {
  active: OnboardingStepId;
}

export function StepProgressBar({ active }: StepProgressBarProps) {
  return (
    <WizardStepProgress
      steps={STEPS}
      active={active}
      ariaLabel="Onboarding progress"
      hideLabelsBelow="sm"
    />
  );
}
