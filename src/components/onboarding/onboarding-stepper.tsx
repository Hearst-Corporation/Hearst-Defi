import { cn } from "@/lib/cn";
import type { OnboardingStep } from "@/lib/onboarding-types";

interface OnboardingStepperProps {
  steps: readonly OnboardingStep[];
  currentStep: number;
  pathLabel: string;
}

/**
 * Sticky horizontal stepper for the LP onboarding flow.
 * Uses Cockpit design tokens exclusively — no hex values.
 */
export function OnboardingStepper({
  steps,
  currentStep,
  pathLabel,
}: OnboardingStepperProps) {
  return (
    <div className="sticky top-0 z-[var(--ct-z-raised)] border-b border-[var(--ct-border)] bg-[var(--ct-bg-deep)] backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-6 py-4">
        {/* Path label */}
        <p className="mb-3 text-xs font-medium uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
          {pathLabel}
        </p>

        {/* Steps row */}
        <ol className="flex items-center gap-0">
          {steps.map((step, index) => {
            const isDone = index < currentStep;
            const isActive = index === currentStep;
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="flex flex-1 items-center">
                {/* Step node */}
                <div className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-[var(--ct-dur-base)]",
                      isDone &&
                        "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
                      isActive &&
                        "border-[var(--ct-accent)] bg-transparent ct-text-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--ct-accent)_20%,transparent)]",
                      !isDone &&
                        !isActive &&
                        "border-[var(--ct-border)] ct-surface-1 ct-text-dim",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isDone ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 7l3.5 3.5L12 3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "mt-1.5 max-w-28 text-center text-xs leading-tight",
                      isActive
                        ? "font-medium ct-text-strong"
                        : "ct-text-dim",
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "mx-1 mb-5 h-px flex-1 transition-colors duration-[var(--ct-dur-base)]",
                      index < currentStep
                        ? "bg-[var(--ct-accent)]"
                        : "bg-[var(--ct-border)]",
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
