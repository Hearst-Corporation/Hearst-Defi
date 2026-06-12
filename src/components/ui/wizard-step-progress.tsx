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

/**
 * Shared horizontal step indicator for multi-step flows (onboarding, invest).
 * Server Component — no interactivity.
 */
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
      className="flex w-full"
    >
      {steps.map((step, i) => {
        const isDone = step.index < activeIndex;
        const isActive = step.id === active;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;

        return (
          <div
            key={step.id}
            className="relative flex flex-1 basis-0 min-w-0 flex-col items-center gap-1"
          >
            {!isFirst && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1/2 top-3.5 left-0 h-px rounded-full transition-colors",
                  isDone || isActive
                    ? "bg-[var(--ct-accent)]"
                    : "bg-[var(--ct-border-soft)]",
                )}
              />
            )}
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-1/2 top-3.5 right-0 h-px rounded-full transition-colors",
                  isDone
                    ? "bg-[var(--ct-accent)]"
                    : "bg-[var(--ct-border-soft)]",
                )}
              />
            )}

            <span
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "relative z-[var(--ct-z-base)] inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border transition-colors",
                isDone &&
                  "border-[var(--ct-border-accent)] bg-[var(--ct-accent)] ct-text-strong",
                isActive &&
                  "border-[var(--ct-border-accent)] bg-[var(--ct-accent-soft)] ct-text-accent shadow-[var(--ct-glow-subtle)]",
                !isDone &&
                  !isActive &&
                  "border-[var(--ct-border-soft)] ct-surface-1 ct-text-muted",
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
                "eyebrow font-medium whitespace-nowrap",
                hideLabelsBelow === "sm" && "hidden sm:block",
                isActive
                  ? "ct-text-accent"
                  : isDone
                    ? "ct-text-primary"
                    : "ct-text-muted",
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
