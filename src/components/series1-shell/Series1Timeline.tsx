export type Series1TimelineStep = {
  label: string;
  detail?: string;
  state?: "done" | "current" | "upcoming";
};

export function Series1Timeline({ steps }: { steps: Series1TimelineStep[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const state = step.state ?? "upcoming";
        const isLast = index === steps.length - 1;
        return (
          <li key={step.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={
                  state === "upcoming"
                    ? "flex size-7 shrink-0 items-center justify-center rounded-(--ct-radius-sm) bg-(--ct-status-neutral-soft) text-xs font-semibold text-(--ct-text-muted) tabular-nums"
                    : "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-(--ct-accent-strong) tabular-nums ring-1 ring-(--ct-border-accent)"
                }
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {!isLast ? (
                <span className="my-1 w-px flex-1 bg-(--ct-border-soft)" />
              ) : null}
            </div>
            <div className={isLast ? "pb-0" : "pb-5"}>
              <p className="pt-1 text-sm font-medium text-(--ct-text-strong)">{step.label}</p>
              {step.detail ? (
                <p className="mt-0.5 text-xs leading-5 text-(--ct-text-muted)">
                  {step.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
