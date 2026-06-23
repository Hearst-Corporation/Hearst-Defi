import {
  WizardStepProgress,
  type WizardStep,
} from "@/components/ui/wizard-step-progress";
import type { InvestStepId } from "@/lib/vaults/invest-routes";

const STEPS: readonly WizardStep<InvestStepId>[] = [
  { id: "select", label: "Select", index: 1 },
  { id: "product", label: "Details", index: 2 },
  { id: "deposit", label: "Deposit", index: 3 },
  { id: "confirmed", label: "Confirmed", index: 4 },
] as const;

interface StepProgressProps {
  active: InvestStepId;
}

export function StepProgress({ active }: StepProgressProps) {
  return (
    <WizardStepProgress
      steps={STEPS}
      active={active}
      ariaLabel="Invest flow progress"
    />
  );
}
