/**
 * MonteCarloPanel — the vault's 36-month Monte Carlo, rendered honestly (sandbox, /portfolio/preview).
 *
 * A compact KPI row (safety / margin-call probability, ending-equity percentiles, engine-backed APY
 * range) over an ending-equity distribution histogram. Client component ONLY for the histogram hover
 * tooltip; every number is precomputed by the pure `runVaultMonteCarlo` engine (this file renders, it
 * does not simulate). Token-only (--ct-*), DS-consistent with the rest of the preview page.
 *
 * Honesty rules held here: green accent + the `hyv-pulse` heartbeat are RESERVED for the one genuinely-
 * Live value (hashprice) elsewhere on the page — they NEVER appear on these simulated projections. Bars
 * are graphite; the Safety card gets only a whisper-faint accent tint (never a green value, never a
 * guarantee). No red anywhere. The deposit breakeven is a neutral hairline. Everything is Estimated /
 * simulated and stamped as such in the footer.
 */
"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import type { VaultMcResult } from "../_data/monte-carlo-preview";

/** Compact money: $531.4k / $1.24M / -$12.0k, tabular-friendly. */
function formatCompactUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** Percent with 1 decimal from a fraction in [0, 1]. */
function formatPctFromFraction(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  /** Whisper-faint accent tint (safety only) — never a green value, never a guarantee. */
  tint?: boolean;
}

export function MonteCarloPanel({ result }: { result: VaultMcResult }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const kpis: readonly KpiCard[] = [
    {
      label: "Safety probability",
      value: formatPctFromFraction(result.safetyProbability),
      hint: "ending ≥ deposit",
      tint: true,
    },
    {
      label: "Margin-call probability",
      value: formatPctFromFraction(result.marginCallProbability),
      hint: "breaches LLTV wall",
    },
    {
      label: "Median ending equity",
      value: formatCompactUsd(result.medianEndingEquityUsd),
      hint: "p50",
    },
    {
      label: "Expected ending equity",
      value: formatCompactUsd(result.expectedEndingEquityUsd),
      hint: "mean",
    },
    {
      label: "P10 ending equity",
      value: formatCompactUsd(result.p10EndingEquityUsd),
      hint: "downside decile",
    },
    {
      label: "P90 ending equity",
      value: formatCompactUsd(result.p90EndingEquityUsd),
      hint: "upside decile",
    },
    {
      label: "APY range · engine",
      value: `${result.apyRange.lowPct.toFixed(1)}–${result.apyRange.highPct.toFixed(1)}%`,
      hint: "p25–p75",
    },
  ];

  const bins = result.histogram;
  const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 0);
  const min = bins.length > 0 ? (bins[0] as (typeof bins)[number]).x0 : 0;
  const max = bins.length > 0 ? (bins[bins.length - 1] as (typeof bins)[number]).x1 : 0;
  const span = max - min || 1;

  // Deposit breakeven position along the equity axis (0..100%). Hidden if it falls outside the range.
  const breakevenPct = ((result.startingEquityUsd - min) / span) * 100;
  const breakevenInRange = breakevenPct >= 0 && breakevenPct <= 100;

  const active = hovered !== null ? (bins[hovered] as (typeof bins)[number] | undefined) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-(--ct-border-soft) @[30rem]:grid-cols-3 @[52rem]:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex min-w-0 flex-col gap-1.5 bg-surface-card px-4 py-4"
            style={
              k.tint
                ? { background: "color-mix(in srgb, var(--ct-accent) 6%, var(--ct-surface-card))" }
                : undefined
            }
          >
            <span className="ct-bento-label min-w-0 truncate">{k.label}</span>
            <span className="ct-bento-metric min-w-0 truncate whitespace-nowrap tabular-nums ct-text-strong">
              {k.value}
            </span>
            <span className="text-[length:var(--ct-text-nano)] ct-text-faint">{k.hint}</span>
          </div>
        ))}
      </div>

      {/* ── Ending-equity distribution ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2 bg-surface-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="ct-bento-label">Ending-equity distribution</span>
          <span className="text-[length:var(--ct-text-nano)] ct-text-faint tabular-nums">
            {formatCompactUsd(result.worst5EndingEquityUsd)} p5 · {formatCompactUsd(result.p90EndingEquityUsd)} p90
          </span>
        </div>

        <div className="relative">
          {/* hover tooltip */}
          {active ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-2 py-1 text-[length:var(--ct-text-nano)] ct-text-body tabular-nums shadow-[var(--ct-glow-dot)]"
              style={{ left: `${((hovered as number) + 0.5) / bins.length * 100}%` }}
            >
              <span className="ct-text-strong">
                {formatCompactUsd(active.x0)} – {formatCompactUsd(active.x1)}
              </span>
              <span className="ct-text-muted">
                {" · "}
                {active.count} paths · {formatPctFromFraction(active.count / result.paths)}
              </span>
            </div>
          ) : null}

          {/* bars */}
          <div className="flex h-36 items-end gap-px" role="img" aria-label="Ending-equity distribution histogram">
            {bins.map((b, i) => {
              const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
              const isActive = hovered === i;
              return (
                <div
                  key={`${b.x0}-${i}`}
                  className="flex h-full min-w-0 flex-1 items-end"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((cur) => (cur === i ? null : cur))}
                >
                  <div
                    className="w-full rounded-t-sm transition-[background,height] duration-150"
                    style={{
                      height: `${Math.max(heightPct, b.count > 0 ? 2 : 0)}%`,
                      background: `color-mix(in srgb, var(--ct-text-strong) ${isActive ? 32 : 16}%, transparent)`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* deposit breakeven hairline */}
          {breakevenInRange ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px"
              style={{ left: `${breakevenPct}%`, background: "var(--ct-border-strong)" }}
            />
          ) : null}
        </div>

        {/* axis: min · deposit breakeven · max */}
        <div className="relative h-4">
          <span className="absolute left-0 text-[length:var(--ct-text-nano)] ct-text-faint tabular-nums">
            {formatCompactUsd(min)}
          </span>
          {breakevenInRange ? (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-[length:var(--ct-text-nano)] ct-text-muted tabular-nums"
              style={{ left: `${breakevenPct}%` }}
            >
              deposit {formatCompactUsd(result.startingEquityUsd)}
            </span>
          ) : null}
          <span className="absolute right-0 text-[length:var(--ct-text-nano)] ct-text-faint tabular-nums">
            {formatCompactUsd(max)}
          </span>
        </div>
      </div>

      {/* ── Footer stamp ────────────────────────────────────────────────────── */}
      <p className={cn("text-[length:var(--ct-text-nano)] ct-text-faint")}>
        Monte Carlo · {result.paths.toLocaleString("en-US")} paths · {result.horizonMonths}-month horizon ·
        seed {result.seed} · Estimated / simulated — not a forecast, not guaranteed.
      </p>
    </div>
  );
}
