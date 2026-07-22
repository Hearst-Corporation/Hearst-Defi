import type { ReactNode } from "react";

import { Series1Panel } from "./Series1Panel";

export type Series1KpiMetric = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

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
      <div className="grid gap-px bg-zinc-950/[0.08] lg:grid-cols-12 dark:bg-white/10">
        <div className="min-w-0 bg-zinc-50 px-6 py-7 lg:col-span-4 dark:bg-zinc-900">
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">
            {hero.label}
          </p>
          <div className="mt-3 truncate text-4xl font-semibold tracking-tight text-zinc-950 tabular-nums sm:text-5xl dark:text-white">
            {hero.value}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hero.hint}</p>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-px sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 bg-white px-4 py-4 dark:bg-zinc-950/40">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{metric.label}</dt>
              <dd className="mt-1 truncate text-xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">
                {metric.value}
              </dd>
              {metric.hint ? (
                <p className="mt-0.5 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
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
