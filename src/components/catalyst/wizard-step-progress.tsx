// Catalyst WizardStepProgress — canonical, token-only. ui/wizard-step-progress re-exports this.
import { cn } from "@/lib/cn";

export interface WizardStep<T extends string> {
  id: T;
  label: string;
  index: number;
  /** Optional one-line hint shown under the label in the `rail` variant. */
  hint?: string;
}

interface WizardStepProgressProps<T extends string> {
  steps: readonly WizardStep<T>[];
  active: T;
  ariaLabel: string;
  hideLabelsBelow?: "sm";
  /**
   * Visual treatment.
   * - `default` — compact dotted row (apply form, onboarding). Unchanged.
   * - `rail` — premium product rail: continuous track, accent-filled progress
   *   segment, larger numbered dots, persistent labels + step caption.
   */
  variant?: "default" | "rail";
}

export function WizardStepProgress<T extends string>({
  steps,
  active,
  ariaLabel,
  hideLabelsBelow,
  variant = "default",
}: WizardStepProgressProps<T>) {
  const activeIndex = steps.find((s) => s.id === active)?.index ?? 1;
  const activeStep = steps.find((s) => s.id === active);
  const isRail = variant === "rail";

  // Fill ratio of the continuous track — from the first dot centre to the
  // current dot centre. 0 at step 1, 1 at the last step.
  const fillRatio =
    steps.length > 1
      ? Math.min(Math.max((activeIndex - 1) / (steps.length - 1), 0), 1)
      : 0;

  return (
    <nav
      aria-label={ariaLabel}
      role="progressbar"
      aria-valuenow={activeIndex}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuetext={`Step ${activeIndex} of ${steps.length}: ${activeStep?.label ?? ""}`}
      className={cn(
        "wizard-step-progress",
        isRail && "wizard-step-progress--rail",
      )}
    >
      {isRail ? (
        <span aria-hidden="true" className="wizard-step-progress__track">
          <span
            className="wizard-step-progress__track-fill"
            style={{ width: `${fillRatio * 100}%` }}
          />
        </span>
      ) : null}

      {steps.map((step, i) => {
        const isDone = step.index < activeIndex;
        const isActive = step.id === active;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.id} className="wizard-step-progress__item">
            {!isRail && !isFirst ? (
              <span
                aria-hidden="true"
                className={cn(
                  "wizard-step-progress__connector wizard-step-progress__connector--left",
                  isDone || isActive
                    ? "wizard-step-progress__connector--done"
                    : "wizard-step-progress__connector--pending",
                )}
              />
            ) : null}
            {!isRail && !isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "wizard-step-progress__connector wizard-step-progress__connector--right",
                  isDone
                    ? "wizard-step-progress__connector--done"
                    : "wizard-step-progress__connector--pending",
                )}
              />
            ) : null}

            <span
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "wizard-step-progress__dot",
                isDone && "wizard-step-progress__dot--done",
                isActive && "wizard-step-progress__dot--active",
                !isDone && !isActive && "wizard-step-progress__dot--pending",
              )}
            >
              {isDone ? (
                <svg
                  aria-hidden="true"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                step.index
              )}
            </span>

            {isRail ? (
              <span className="wizard-step-progress__copy">
                <span
                  className={cn(
                    "wizard-step-progress__caption",
                    isActive && "wizard-step-progress__caption--active",
                    isDone && "wizard-step-progress__caption--done",
                    !isDone &&
                      !isActive &&
                      "wizard-step-progress__caption--pending",
                  )}
                >
                  {isDone ? "Done" : isActive ? "Current" : `Step ${step.index}`}
                </span>
                <span
                  className={cn(
                    "wizard-step-progress__label",
                    isActive && "wizard-step-progress__label--active",
                    isDone && "wizard-step-progress__label--done",
                    !isDone &&
                      !isActive &&
                      "wizard-step-progress__label--pending",
                  )}
                >
                  {step.label}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  "wizard-step-progress__label eyebrow",
                  hideLabelsBelow === "sm" && "hidden sm:block",
                  isActive && "wizard-step-progress__label--active",
                  isDone && "wizard-step-progress__label--done",
                  !isDone && !isActive && "wizard-step-progress__label--pending",
                )}
              >
                {step.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
