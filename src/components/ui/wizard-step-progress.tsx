import { cn } from "@/lib/cn";

export interface WizardStep<T extends string> {
  id: T;
  label: string;
  index: number;
}

interface WizardStepProgressProps<T extends string> {
  steps: readonly WizardStep<T>[];
  active: T;
  ariaLabel: string;
  hideLabelsBelow?: "sm";
}

export function WizardStepProgress<T extends string>({
  steps,
  active,
  ariaLabel,
  hideLabelsBelow,
}: WizardStepProgressProps<T>) {
  const activeIndex = steps.find((s) => s.id === active)?.index ?? 1;
  const activeStep = steps.find((s) => s.id === active);

  return (
    <nav
      aria-label={ariaLabel}
      role="progressbar"
      aria-valuenow={activeIndex}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuetext={`Step ${activeIndex} of ${steps.length}: ${activeStep?.label ?? ""}`}
      className="wizard-step-progress"
    >
      {steps.map((step, i) => {
        const isDone = step.index < activeIndex;
        const isActive = step.id === active;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.id} className="wizard-step-progress__item">
            {!isFirst ? (
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
            {!isLast ? (
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
          </div>
        );
      })}
    </nav>
  );
}
