import type { ReactNode } from "react";

import { surfaceClassName } from "@/lib/ui/surface-classes";

export type Series1KpiMetric = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

// Gap-px KPI band (doctrine §7 — separators come from the gap, never a
// hairline per cell). This band is the ONE raised object of its route
// (surface "primary"); every other Series1Panel stays flat — depth marks
// the page's thesis, it is not sprinkled on every block.
export function Series1KpiBand({
  hero,
  metrics,
}: {
  hero: { label: string; value: ReactNode; hint: ReactNode };
  metrics: Series1KpiMetric[];
}) {
  return (
    <div className={surfaceClassName("primary")}>
      {/* The grid gap exposes the divider colour as 1px rules between cells. */}
      <div className="grid gap-px bg-(--ct-border-soft) lg:grid-cols-12">
        <div className="min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_55%,var(--ct-surface-page))] px-6 py-7 lg:col-span-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-(--ct-text-muted) uppercase">
            {hero.label}
          </p>
          <div className="mt-3 truncate text-4xl font-semibold tracking-tight text-(--ct-text-strong) tabular-nums sm:text-5xl">
            {hero.value}
          </div>
          <p className="mt-2 text-xs text-(--ct-text-faint)">{hero.hint}</p>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-px sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {/* NOT delegated to Metric variant="nested". The nested variant styles
              its label with .stat-label (11px / bold / uppercase / widest
              tracking) and its value with .stat-value (32px / extrabold /
              --ct-accent GREEN). These band cells are label=13px/medium/muted,
              value=19px/semibold/--ct-text-strong (white) — different on every
              axis (size, weight, colour, casing). Wiring nested here would move
              every pixel and repaint the value green, breaking the gap-px band
              soldering. Rendu stable PRIME sur la convergence : left in place. */}
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))] px-4 py-4"
            >
              <dt className="text-xs font-medium text-(--ct-text-muted)">{metric.label}</dt>
              <dd className="mt-1 truncate text-xl font-semibold tracking-tight text-(--ct-text-strong) tabular-nums">
                {metric.value}
              </dd>
              {metric.hint ? (
                <p className="mt-0.5 text-[length:var(--ct-text-deci)] leading-4 text-(--ct-text-faint)">
                  {metric.hint}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
