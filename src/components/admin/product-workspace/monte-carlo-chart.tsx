"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from "chart.js";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";
import { cn } from "@/lib/cn";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

/**
 * Monte-Carlo spaghetti plot. Hundreds of individual seeded GBM trajectories are
 * drawn thin + faint (green tints), with ONE bold principal/median path on top.
 * Chart.js (not recharts) handles the line count; visuals are pinned to the
 * Hearst dark-green DS (resolved --ct-* values).
 */

/* Chart.js renders to <canvas> and can't read CSS vars live, so the DS palette is
   resolved at runtime from the live --ct-* tokens (single source of truth in
   cockpit.css). The accent is the sanctioned brand-constant literal; everything
   else is read off document.documentElement. */
type DsColors = {
  accent: string;
  surfaceCard: string;
  textStrong: string;
  muted: string;
  border: string;
  gridSoft: string;
};

function readToken(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return raw || fallback;
}

function resolveDsColors(): DsColors {
  return {
    accent: readToken("--ct-accent", CONNECT_ACCENT_HEX),
    surfaceCard: readToken("--ct-surface-card", "#000"),
    textStrong: readToken("--ct-text-strong", CONNECT_ACCENT_HEX),
    muted: readToken("--ct-text-muted", CONNECT_ACCENT_HEX),
    border: readToken("--ct-border", "transparent"),
    gridSoft: readToken("--ct-border-soft", "transparent"),
  };
}

/** Faint accent tints for the spaghetti — luminance ramp of the single accent,
 *  built from the resolved accent so there is no second green literal. */
function buildSpaghettiTints(accent: string): readonly string[] {
  const alphas = [0.18, 0.13, 0.22, 0.1, 0.16];
  return alphas.map((a) => `color-mix(in srgb, ${accent} ${Math.round(a * 100)}%, transparent)`);
}

/** Seeded PRNG (mulberry32) so the simulation is deterministic — no Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runMonteCarloSimulation(
  initialValue: number,
  horizonMonths: number,
  expectedAnnualReturn: number,
  annualVolatility: number,
  simulationsCount: number,
  seed: number,
) {
  const rng = mulberry32(seed);
  const steps = Math.max(1, Math.round(horizonMonths));
  const dt = 1 / 12;
  const allTrajectories: number[][] = [];

  for (let i = 0; i < simulationsCount; i++) {
    const trajectory: number[] = [initialValue];
    let currentValue = initialValue;
    for (let t = 1; t <= steps; t++) {
      const u1 = rng();
      const u2 = rng();
      const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const drift =
        (expectedAnnualReturn - 0.5 * Math.pow(annualVolatility, 2)) * dt;
      const shock = annualVolatility * Math.sqrt(dt) * randNormal;
      currentValue = currentValue * Math.exp(drift + shock);
      trajectory.push(Math.round(currentValue));
    }
    allTrajectories.push(trajectory);
  }

  const median: number[] = [];
  for (let t = 0; t <= steps; t++) {
    const vals = allTrajectories.map((traj) => traj[t] ?? 0).sort((a, b) => a - b);
    median.push(vals[Math.floor(simulationsCount * 0.5)] ?? 0);
  }
  return { allTrajectories, median };
}

/** Compact USD formatter for axis ticks ($10k, $1.2M …). */
function formatCompactUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return `$${value}`;
}

function formatFullUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Index formatter (base-100 framing) — a plain number, no currency. */
function formatIndex(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function MonteCarloChart({
  initialValue = 10_000,
  horizonMonths = 120,
  expectedAnnualReturn = 0.07,
  annualVolatility = 0.15,
  seed = 1878790276,
  renderedPaths = 220,
  reportedPaths,
  title = "Monte-Carlo projection",
  description,
  caption = "Seeded simulation · illustrative dispersion, not guaranteed.",
  bare = false,
  showHeader = true,
  indexed = false,
  className,
}: {
  initialValue?: number;
  horizonMonths?: number;
  expectedAnnualReturn?: number;
  annualVolatility?: number;
  seed?: number;
  renderedPaths?: number;
  reportedPaths?: number;
  title?: string;
  description?: string;
  caption?: string;
  bare?: boolean;
  showHeader?: boolean;
  /** Render the Y axis as an INDEX (base = initialValue), not $. Honest framing
   *  for the illustrative dispersion — the paths are not a real capital amount. */
  indexed?: boolean;
  className?: string;
}) {
  const compactFmt = indexed ? formatIndex : formatCompactUsd;
  const fullFmt = indexed ? formatIndex : formatFullUsd;
  const tooltipLead = indexed ? "Principal · index" : "Principal";
  const drawnPaths = Math.max(24, Math.min(renderedPaths, reportedPaths ?? renderedPaths));
  const months = Math.max(1, Math.round(horizonMonths));
  const summary =
    description ??
    `${months} months · ${drawnPaths} rendered${reportedPaths && reportedPaths !== drawnPaths ? ` from ${reportedPaths.toLocaleString("en-US")} seeded paths` : ` seeded paths`}`;

  // Resolve the DS palette once on mount from the live --ct-* tokens. The
  // initializer runs under SSR too (window undefined → fallbacks), so we re-read
  // the real --ct-* values after hydration. Intentional one-shot sync on mount.
  const [ds, setDs] = React.useState<DsColors>(() => resolveDsColors());
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDs(resolveDsColors());
  }, []);
  const spaghettiTints = React.useMemo(() => buildSpaghettiTints(ds.accent), [ds.accent]);

  const { allTrajectories, median } = React.useMemo(
    () =>
      runMonteCarloSimulation(
        initialValue,
        months,
        expectedAnnualReturn,
        annualVolatility,
        drawnPaths,
        seed,
      ),
    [initialValue, months, expectedAnnualReturn, annualVolatility, drawnPaths, seed],
  );

  const labels = React.useMemo(
    () =>
      Array.from({ length: months + 1 }, (_, i) =>
        i === 0 ? "Start" : `M${i}`,
      ),
    [months],
  );

  const data = React.useMemo(() => {
    const spaghetti = allTrajectories.map((traj, idx) => ({
      label: `path-${idx}`,
      data: traj,
      borderColor: spaghettiTints[idx % spaghettiTints.length],
      borderWidth: 0.8,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.25,
      fill: false,
      order: 2,
    }));

    const principal = {
      label: "Principal strategy (median)",
      data: median,
      borderColor: ds.accent,
      borderWidth: 2.75,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: ds.accent,
      pointHoverBorderColor: ds.surfaceCard,
      pointHoverBorderWidth: 2,
      tension: 0.25,
      fill: false,
      order: 0,
    };

    return { labels, datasets: [...spaghetti, principal] };
  }, [allTrajectories, median, labels, spaghettiTints, ds.accent, ds.surfaceCard]);

  const options = React.useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ds.surfaceCard,
          borderColor: ds.border,
          borderWidth: 1,
          titleColor: ds.textStrong,
          bodyColor: ds.muted,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          // Only surface the principal path in the tooltip — spaghetti is texture.
          filter: (item) => item.datasetIndex === data.datasets.length - 1,
          callbacks: {
            title: (items) => {
              const raw = items[0]?.label ?? "";
              return raw === "Start" ? "Start" : `Month ${raw.replace("M", "")}`;
            },
            label: (ctx) =>
              `${tooltipLead} ${fullFmt(Number(ctx.raw))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: ds.muted,
            font: { size: 11 },
            maxRotation: 0,
            autoSkipPadding: 16,
          },
        },
        y: {
          grid: { color: ds.gridSoft },
          border: { display: false },
          ticks: {
            color: ds.muted,
            font: { size: 11 },
            maxTicksLimit: 6,
            callback: (value) => compactFmt(Number(value)),
          },
        },
      },
    }),
    [data.datasets.length, ds.surfaceCard, ds.border, ds.textStrong, ds.muted, ds.gridSoft, compactFmt, fullFmt, tooltipLead],
  );

  const finalMid = median[months] ?? 0;
  const chartBody = (
    <>
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-(--ct-space-3)">
          <div className="flex flex-col gap-(--ct-space-1)">
            <div className={cn(bare ? "ct-section-label ct-text-strong" : "")}>
              {bare ? title : null}
            </div>
            {bare ? (
              <p className="ct-metric-caption ct-text-muted">{summary}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-(--ct-space-2) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-2_5) py-(--ct-space-1_5)">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ct-accent)]"
            />
            <span className="ct-metric-caption ct-text-muted">Principal strategy</span>
            <span className="mono text-[length:var(--ct-text-sm)] font-semibold tabular-nums ct-text-strong">
              {compactFmt(finalMid)}
            </span>
          </div>
        </div>
      ) : null}
      <div className={cn("w-full", bare ? "h-[320px]" : "h-[360px]")}>
        <Line options={options} data={data} />
      </div>
      <div className="flex flex-wrap items-center gap-x-(--ct-space-4) gap-y-(--ct-space-2)">
        <span className="ct-metric-caption ct-text-faint">{caption}</span>
        <span className="ct-metric-caption ct-text-muted">
          μ {formatPct(expectedAnnualReturn)} · σ {formatPct(annualVolatility)} · seed {seed}
        </span>
      </div>
    </>
  );

  if (bare) {
    return <div className={cn("flex flex-col gap-(--ct-space-4)", className)}>{chartBody}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-(--ct-space-3)">
          <div className="flex flex-col gap-(--ct-space-1)">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
          <div className="flex items-center gap-(--ct-space-2) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-2_5) py-(--ct-space-1_5)">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ct-accent)]"
            />
            <span className="ct-metric-caption ct-text-muted">Principal strategy</span>
            <span className="mono text-[length:var(--ct-text-sm)] font-semibold tabular-nums ct-text-strong">
              {compactFmt(finalMid)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-(--ct-space-4)">
          <div className="h-[360px] w-full">
            <Line options={options} data={data} />
          </div>
          <div className="flex flex-wrap items-center gap-x-(--ct-space-4) gap-y-(--ct-space-2)">
            <p className="ct-metric-caption ct-text-faint">{caption}</p>
            <span className="ct-metric-caption ct-text-muted">
              μ {formatPct(expectedAnnualReturn)} · σ {formatPct(annualVolatility)} · seed {seed}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
