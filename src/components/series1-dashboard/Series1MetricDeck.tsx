// Series1MetricDeck — the replacement for Series1KpiBand (canon: DELETE).
//
// What the old band did wrong (canon F2 + F3), and what changes here:
//
//   F2  `grid gap-px bg-white/10` with 7 opaque cells: the grid GUTTER was the
//       1px rule, so the band rendered as a spreadsheet. Here each metric is a
//       real card in a responsive grid with real spacing — no gutter-as-border,
//       no divider grid.
//
//   F3  every cell printed `reasonLabel(reason)` AS ITS VALUE, so one motive
//       repeated across the whole band in large type. Here an unresolved metric
//       shows an em dash, and the motive is stated ONCE by the caller through
//       <Series1DataState>.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface Series1Metric {
  label: string;
  value: ReactNode;
  /** What the figure means / where it comes from. Never a motive. */
  hint?: ReactNode;
  /** The underlying read did not resolve — render the cell quiet. */
  muted?: boolean;
}

export function Series1MetricDeck({
  metrics,
  className,
}: {
  metrics: readonly Series1Metric[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex min-w-0 flex-col rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-raised)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]"
        >
          <p
            className="m-0 text-[var(--ct-text-muted)]"
            style={{ fontSize: "var(--ct-text-2xs)" }}
          >
            {metric.label}
          </p>
          <p
            className={cn(
              "m-0 mt-[var(--ct-space-2)] truncate font-semibold tracking-tight tabular-nums",
              metric.muted
                ? "text-[var(--ct-text-faint)]"
                : "text-[var(--ct-text-strong)]",
            )}
            style={{ fontSize: "var(--ct-text-3xl-fixed)" }}
          >
            {metric.value}
          </p>
          {metric.hint ? (
            <p
              className="m-0 mt-[var(--ct-space-1)] leading-relaxed text-[var(--ct-text-faint)]"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              {metric.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
