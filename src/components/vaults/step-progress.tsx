import { cn } from "@/lib/cn";
import type { InvestStepId } from "@/lib/vaults/invest-routes";

interface InvestStep {
  id: InvestStepId;
  label: string;
  index: number;
}

const STEPS: readonly InvestStep[] = [
  { id: "select", label: "Select", index: 1 },
  { id: "product", label: "Details", index: 2 },
  { id: "deposit", label: "Deposit", index: 3 },
  { id: "confirmed", label: "Confirmed", index: 4 },
] as const;

interface StepProgressProps {
  active: InvestStepId;
}

/**
 * Invest funnel step indicator — pure bento (Portfolio canon).
 *
 * Current step: --ct-accent filled circle + strong label.
 * Done step: accent ring + check, accent caption.
 * Future step: faint label, --ct-border circle.
 * Connectors: soft white-alpha, accent once crossed.
 */
export function StepProgress({ active }: StepProgressProps) {
  const activeIndex = STEPS.find((s) => s.id === active)?.index ?? 1;
  const activeStep = STEPS.find((s) => s.id === active);

  return (
    <nav
      aria-label="Invest flow progress"
      role="progressbar"
      aria-valuenow={activeIndex}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuetext={`Step ${activeIndex} of ${STEPS.length}: ${activeStep?.label ?? ""}`}
      className="flex w-full items-center"
    >
      {STEPS.map((step, i) => {
        const isDone = step.index < activeIndex;
        const isActive = step.id === active;
        const isLast = i === STEPS.length - 1;
        const crossed = step.index < activeIndex;

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-2.5",
              !isLast && "flex-1",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-colors",
                  isActive &&
                    "border-transparent bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
                  isDone &&
                    "border-[var(--ct-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
                  !isActive &&
                    !isDone &&
                    "border-[var(--ct-border)] bg-surface-inset text-[var(--ct-text-faint)]",
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
                      strokeWidth="1.75"
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
                  "ct-bento-label hidden transition-colors sm:block",
                  isActive && "text-[var(--ct-text-strong)]",
                  isDone && "text-[var(--ct-accent)]",
                  !isActive && !isDone && "text-[var(--ct-text-faint)]",
                )}
              >
                {step.label}
              </span>
            </div>

            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px min-w-4 flex-1 rounded-full transition-colors",
                  crossed ? "bg-[color-mix(in_srgb,var(--ct-accent)_60%,transparent)]" : "bg-[color-mix(in_srgb,var(--ct-text-strong)_8%,transparent)]",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
