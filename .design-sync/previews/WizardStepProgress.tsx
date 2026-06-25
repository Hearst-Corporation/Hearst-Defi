// WizardStepProgress preview — the onboarding stepper for the $250k subscription flow:
// Identity → Accreditation → Funding → Review. Shows an early and a late active step.
import { WizardStepProgress } from "hearst-connect";

const STEPS = [
  { id: "identity", label: "Identity", index: 1 },
  { id: "accreditation", label: "Accreditation", index: 2 },
  { id: "funding", label: "Funding", index: 3 },
  { id: "review", label: "Review", index: 4 },
] as const;

const frame: React.CSSProperties = {
  width: "520px",
  padding: "20px",
  borderRadius: "14px",
  border: "1px solid var(--ct-border-ghost)",
  background: "var(--ct-surface-1)",
};

export const Accreditation = () => (
  <div style={frame}>
    <WizardStepProgress
      steps={STEPS}
      active="accreditation"
      ariaLabel="Onboarding progress"
    />
  </div>
);

export const Review = () => (
  <div style={frame}>
    <WizardStepProgress
      steps={STEPS}
      active="review"
      ariaLabel="Onboarding progress"
    />
  </div>
);

export const FirstStep = () => (
  <div style={frame}>
    <WizardStepProgress
      steps={STEPS}
      active="identity"
      ariaLabel="Onboarding progress"
    />
  </div>
);
