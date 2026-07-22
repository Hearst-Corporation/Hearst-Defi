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
      {/* Separator plane: the grid gap exposes this fill as 1px rules between
          cells, so the hairline colour lives here rather than on borders. */}
      <div className="grid gap-px lg:grid-cols-12" style={{ background: "var(--s1-line)" }}>
        {/* Hero = the one lifted cell of the band: raised fill, accent bloom,
            top bevel. It reads above the panel; every metric reads below it. */}
        <div
          className="relative min-w-0 px-6 py-7 lg:col-span-4"
          style={{
            background:
              "radial-gradient(120% 130% at 0% 0%, var(--s1-glow), transparent 70%), linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 14rem), var(--s1-panel-elevated)",
            boxShadow: "inset 0 1px 0 var(--s1-highlight)",
          }}
        >
          <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--s1-accent)" }}>
            {hero.label}
          </p>
          <div className="mt-3 truncate text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
            {hero.value}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--s1-muted)" }}>
            {hero.hint}
          </p>
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-px sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 px-4 py-4"
              style={{ background: "var(--s1-inset)", boxShadow: "var(--s1-shadow-inset)" }}
            >
              <dt className="text-xs font-medium" style={{ color: "var(--s1-muted)" }}>
                {metric.label}
              </dt>
              <dd className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums">{metric.value}</dd>
              {metric.hint ? (
                <p className="mt-0.5 text-[10px] leading-4" style={{ color: "var(--s1-muted)" }}>
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
