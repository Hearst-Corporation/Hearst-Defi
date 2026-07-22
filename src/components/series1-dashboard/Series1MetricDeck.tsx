// Series1MetricDeck — the DS `KpiBand`: six cells of equal weight.
//
// Reproduces design-system.html §09 "KpiBand — six cases de poids égal":
//   dl.kpi-grid.kpi-6 → gap-px over white/5, welded inside one surfaceRaised,
//   responsive 2 → 3 → 6 columns, each cell `dt` 12px muted / `dd` 24px
//   semibold tracking-tight tabular-nums / hint 10px faint.
//
// The first rebuild rendered six SEPARATE bordered boxes with a gap. That is
// what read as "cartes gris sale" and broke the rhythm: the DS band is ONE
// instrument, subdivided by hairline gutters — not six cards side by side.
//
// Honesty is unchanged: an unresolved metric shows an em dash and renders
// quiet; the motive is stated once by the caller (canon F3), never per cell.

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
        "overflow-hidden rounded-[var(--ct-radius-xl)] bg-[var(--ct-surface-raised)]",
        "shadow-[var(--ct-shadow-soft)] ring-1 ring-[var(--ct-border)]",
        className,
      )}
    >
      <dl className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-w-0 flex-col bg-[var(--ct-surface-raised)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]"
          >
            <dt
              className="m-0 font-medium text-[var(--ct-text-muted)]"
              style={{ fontSize: "var(--ct-text-2xs)" }}
            >
              {metric.label}
            </dt>
            <dd
              className={cn(
                "m-0 mt-[var(--ct-space-1)] truncate font-semibold tracking-tight tabular-nums",
                metric.muted
                  ? "text-[var(--ct-text-faint)]"
                  : "text-[var(--ct-text-strong)]",
              )}
              style={{ fontSize: "var(--ct-text-3xl-fixed)", lineHeight: 1.15 }}
            >
              {metric.value}
            </dd>
            {metric.hint ? (
              <p
                className="m-0 mt-[var(--ct-space-1)] leading-tight text-[var(--ct-text-faint)]"
                style={{ fontSize: "var(--ct-text-nano)" }}
              >
                {metric.hint}
              </p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
