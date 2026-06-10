import { cn } from "@/lib/cn";

type StepId = "select" | "product" | "deposit" | "confirmed";

const STEPS: { id: StepId; label: string; index: number }[] = [
  { id: "select", label: "Select", index: 1 },
  { id: "product", label: "Details", index: 2 },
  { id: "deposit", label: "Deposit", index: 3 },
  { id: "confirmed", label: "Confirmed", index: 4 },
];

interface StepProgressProps {
  active: StepId;
}

/**
 * 4-step wizard progress bar for the Invest flow.
 * Server Component — no interactivity, pure display.
 */
export function StepProgress({ active }: StepProgressProps) {
  const activeIndex = STEPS.find((s) => s.id === active)?.index ?? 1;

  return (
    <nav aria-label="Invest flow progress" className="flex w-full">
      {STEPS.map((step, i) => {
        const isDone = step.index < activeIndex;
        const isActive = step.id === active;
        const isFirst = i === 0;
        const isLast = i === STEPS.length - 1;
        // A connector segment is "filled" once the step it leads INTO is
        // reached: left half fills when this step is done/active, right half
        // fills when this step is done.
        const leftFilled = isDone || isActive;
        const rightFilled = isDone;

        return (
          // Each step owns an equal-width cell, so all circles share the same
          // vertical line and are evenly spaced. The last cell is identical to
          // the others — its trailing connector half is simply hidden.
          <div
            key={step.id}
            className="relative flex flex-1 basis-0 min-w-0 flex-col items-center gap-1"
          >
            {/* Connector track: two halves drawn at the circle's vertical
                center, each reaching to the cell edge so adjacent circles
                connect center-to-center. Hidden at the row's outer edges. */}
            {!isFirst && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1/2 top-3.5 left-0 h-px rounded-full transition-colors",
                  leftFilled
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
                  rightFilled
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
                isDone && "border-[var(--ct-border-accent)] bg-[var(--ct-accent)]",
                isDone && "ct-text-strong",
                isActive &&
                  "border-[var(--ct-border-accent)] bg-[var(--ct-accent-soft)] ct-text-accent shadow-[var(--ct-glow-subtle)]",
                !isDone && !isActive && "border-[var(--ct-border-soft)] ct-surface-1",
                !isDone && !isActive && "ct-text-muted",
              )}
            >
              {isDone ? (
                // Checkmark placeholder for completed steps
                <span className="inline-block w-3 h-3 rounded-sm bg-current" />
              ) : (
                step.index
              )}
            </span>

            {/* Label */}
            <span
              className={cn(
                "eyebrow font-medium whitespace-nowrap",
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
