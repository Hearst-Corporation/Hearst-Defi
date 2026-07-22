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
                    ? "flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-500 tabular-nums dark:bg-white/5 dark:text-zinc-400"
                    : "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-(--ct-accent-strong) tabular-nums ring-1 ring-(--ct-border-accent)"
                }
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {!isLast ? (
                <span className="my-1 w-px flex-1 bg-zinc-950/10 dark:bg-white/10" />
              ) : null}
            </div>
            <div className={isLast ? "pb-0" : "pb-5"}>
              <p className="pt-1 text-sm font-medium text-zinc-950 dark:text-white">{step.label}</p>
              {step.detail ? (
                <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
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
