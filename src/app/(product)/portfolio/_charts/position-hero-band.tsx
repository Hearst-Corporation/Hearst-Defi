// Position hero band — the Qatar-cockpit signature hero, cell-for-cell, on
// Hearst tokens (green accent kept). The look is a hairline-gapped tile grid:
// `gap-px` over a border-coloured background so each cell reads as a pane
// separated by a 1px bleed — NOT rounded cards. Left pane = the giant headline
// KPI (position value); right pane = a 3-up sub-grid of supporting metrics.
//
// Reference DNA reproduced:
//   grid gap-px bg-<border> lg:grid-cols-12
//     └ cell bg-<surface-page> px-6 py-7 lg:col-span-4   (headline)
//     └ dl grid gap-px lg:col-span-8 lg:grid-cols-3      (metrics)
// Eyebrow in accent; headline text-5xl→6xl tabular; metric values text-2xl.

import type { ReactNode } from "react";

export interface HeroMetric {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export function PositionHeroBand({
  eyebrow,
  headlineLabel,
  headlineValue,
  headlineHint,
  metrics,
}: {
  eyebrow: string;
  headlineLabel: string;
  headlineValue: ReactNode;
  headlineHint?: ReactNode;
  metrics: readonly HeroMetric[];
}) {
  return (
    <div
      className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--ct-radius-xl)] ring-1 ring-[var(--ct-border)] lg:grid-cols-12"
      style={{ background: "var(--ct-border)" }}
    >
      {/* Headline pane */}
      <div className="bg-[var(--ct-surface-page)] px-[var(--ct-space-6)] py-[var(--ct-space-7)] lg:col-span-4">
        <p className="m-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--ct-accent-strong)]">
          {eyebrow}
        </p>
        <p className="m-0 mt-2 text-[11px] font-medium text-[var(--ct-text-muted)]">{headlineLabel}</p>
        <div className="mt-3 text-nowrap text-4xl font-semibold tracking-tight tabular-nums text-[var(--ct-text-strong)] sm:text-5xl xl:text-6xl">
          {headlineValue}
        </div>
        {headlineHint ? (
          <div className="mt-3 text-xs text-[var(--ct-text-faint)]">{headlineHint}</div>
        ) : null}
      </div>

      {/* Metrics sub-grid */}
      <dl
        className="grid grid-cols-2 gap-px bg-[var(--ct-border)] lg:col-span-8 lg:grid-cols-3"
        style={{ background: "var(--ct-border)" }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex flex-col justify-center bg-[var(--ct-surface-page)] px-[var(--ct-space-5)] py-[var(--ct-space-5)]"
          >
            <dt className="text-xs font-medium text-[var(--ct-text-muted)]">{m.label}</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ct-text-strong)]">
              {m.value}
            </dd>
            {m.hint ? (
              <p className="m-0 mt-0.5 text-[10px] leading-tight text-[var(--ct-text-faint)]">{m.hint}</p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
