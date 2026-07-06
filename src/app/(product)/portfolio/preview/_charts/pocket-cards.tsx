/**
 * PocketCards — the 3 vault pockets (B1/B2/B3) as accent-colored metric cards. Each card carries a
 * color chip + allocation bar drawn from the accent ramp (same single-green tints as the composition
 * ring), so Mining power / wBTC / USDC read as one colored family. Token-only. Server component.
 */
const RAMP: readonly string[] = [
  "var(--ct-chart-series-1)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-3)",
];

export interface PocketCard {
  label: string;
  valueUsdc: number;
  pct: number;
  role: string;
}

export function PocketCards({
  pockets,
  format,
}: {
  pockets: readonly PocketCard[];
  format: (n: number) => string;
}) {
  return (
    <div className="grid h-full grid-cols-1 gap-px overflow-hidden rounded-xl bg-[var(--ct-border-soft)] sm:grid-cols-3">
      {pockets.map((p, i) => {
        const color = RAMP[i % RAMP.length] ?? "var(--ct-accent)";
        return (
          <div key={p.label} className="flex min-w-0 flex-col justify-between gap-2 bg-surface-card p-4">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: color }}
              />
              <span className="ct-bento-label truncate">{p.label}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="ct-metric-value text-[length:var(--ct-text-2xl)] tabular-nums">{p.pct}%</span>
              <span className="ct-metric-caption tabular-nums">{format(p.valueUsdc)}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--ct-surface-inset)" }}
            >
              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: color }} />
            </div>
            <span className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">{p.role}</span>
          </div>
        );
      })}
    </div>
  );
}
