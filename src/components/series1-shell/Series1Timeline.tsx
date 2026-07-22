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
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums"
                style={{
                  background: state === "upcoming" ? "var(--s1-inset)" : "var(--s1-accent-soft)",
                  color: state === "upcoming" ? "var(--s1-muted)" : "var(--s1-accent)",
                  boxShadow: state === "upcoming" ? "var(--s1-shadow-inset)" : "inset 0 1px 0 var(--s1-highlight)",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {!isLast ? <span className="my-1 w-px flex-1" style={{ background: "var(--s1-line)" }} /> : null}
            </div>
            <div className={isLast ? "pb-0" : "pb-5"}>
              <p className="pt-1 text-sm font-medium">{step.label}</p>
              {step.detail ? (
                <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
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
