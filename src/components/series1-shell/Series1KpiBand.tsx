import type { ReactNode } from "react";

import { Series1Panel } from "./Series1Panel";

export type Series1KpiMetric = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

// Gap-px KPI band (doctrine §7 — separators come from the gap, never a
// hairline per cell). Cell fills are the same color-mix depth steps the
// surface grammar uses: hero cell slightly raised, metric cells at panel
// depth, divider = --ct-border-soft showing through the gap.
export function Series1KpiBand({
  hero,
  metrics,
}: {
  hero: { label: string; value: ReactNode; hint: ReactNode };
  metrics: Series1KpiMetric[];
}) {
  return (
    <Series1Panel>
      {/* The grid gap exposes the divider colour as 1px rules between cells. */}
      <div className="grid gap-px bg-(--ct-border-soft) lg:grid-cols-12">
        <div className="min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))] px-6 py-7 lg:col-span-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-(--ct-text-muted) uppercase">
            {hero.label}
          </p>
          <div className="mt-3 truncate text-4xl font-semibold tracking-tight text-(--ct-text-strong) tabular-nums sm:text-5xl">
            {hero.value}
          </div>
          <p className="mt-2 text-xs text-(--ct-text-faint)">{hero.hint}</p>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-px sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_75%,var(--ct-surface-page))] px-4 py-4"
            >
              <dt className="text-xs font-medium text-(--ct-text-muted)">{metric.label}</dt>
              <dd className="mt-1 truncate text-xl font-semibold tracking-tight text-(--ct-text-strong) tabular-nums">
                {metric.value}
              </dd>
              {metric.hint ? (
                <p className="mt-0.5 text-[10px] leading-4 text-(--ct-text-faint)">
                  {metric.hint}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </Series1Panel>
  );
}
