/**
 * StepProgressBar — 7-step onboarding progress indicator.
 *
 * A11y: role="progressbar" + aria-valuenow / aria-valuemin / aria-valuemax.
 * Labels for each step are rendered; the active step has aria-current="step".
 * Cockpit tokens only — no hex, no magic px.
 */

import { cn } from "@/lib/cn";

export type OnboardingStepId =
  | "landing"
  | "accreditation"
  | "identity"
  | "wallet"
  | "review"
  | "deposit"
  | "confirmed";

const STEPS: { id: OnboardingStepId; label: string; index: number }[] = [
  { id: "landing",       label: "Start",        index: 1 },
  { id: "accreditation", label: "Accreditation", index: 2 },
  { id: "identity",      label: "Identity",      index: 3 },
  { id: "wallet",        label: "Wallet",        index: 4 },
  { id: "review",        label: "Review",        index: 5 },
  { id: "deposit",       label: "Deposit",       index: 6 },
  { id: "confirmed",     label: "Confirmed",     index: 7 },
];

interface StepProgressBarProps {
  active: OnboardingStepId;
}

export function StepProgressBar({ active }: StepProgressBarProps) {
  const activeIndex = STEPS.find((s) => s.id === active)?.index ?? 1;
  const pct = Math.round(((activeIndex - 1) / (STEPS.length - 1)) * 100);

  return (
    <nav
      aria-label="Onboarding progress"
      role="progressbar"
      aria-valuenow={activeIndex}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuetext={`Step ${activeIndex} of ${STEPS.length}: ${STEPS[activeIndex - 1]?.label ?? ""}`}
      className="flex w-full"
      data-pct={pct}
    >
      {STEPS.map((step, i) => {
        const isDone   = step.index < activeIndex;
        const isActive = step.id === active;
        const isFirst  = i === 0;
        const isLast   = i === STEPS.length - 1;

        return (
          <div
            key={step.id}
            className="relative flex flex-1 basis-0 min-w-0 flex-col items-center gap-1"
          >
            {/* Left connector half */}
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
            {/* Right connector half */}
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

            {/* Circle */}
            <span
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "relative z-[var(--ct-z-base)] inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border transition-colors",
                isDone && "border-[var(--ct-border-accent)] bg-[var(--ct-accent)] ct-text-strong",
                isActive && "border-[var(--ct-border-accent)] bg-[var(--ct-accent-soft)] ct-text-accent shadow-[var(--ct-glow-subtle)]",
                !isDone && !isActive && "border-[var(--ct-border-soft)] ct-surface-1 ct-text-muted",
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

            {/* Label — hide on very narrow viewports */}
            <span
              className={cn(
                "eyebrow font-medium whitespace-nowrap hidden sm:block",
                isActive ? "ct-text-accent" : isDone ? "ct-text-primary" : "ct-text-muted",
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
