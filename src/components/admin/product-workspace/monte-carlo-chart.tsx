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
} from "@/components/ui/card";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

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
  initialCapital: number,
  years: number,
  expectedReturn: number,
  volatility: number,
  simulationsCount: number,
  seed: number,
) {
  const rng = mulberry32(seed);
  const steps = years;
  const allTrajectories: number[][] = [];

  for (let i = 0; i < simulationsCount; i++) {
    const trajectory: number[] = [initialCapital];
    let currentCapital = initialCapital;
    for (let t = 1; t <= steps; t++) {
      const u1 = rng();
      const u2 = rng();
      const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const drift = expectedReturn - 0.5 * Math.pow(volatility, 2);
      const shock = volatility * randNormal;
      currentCapital = currentCapital * Math.exp(drift + shock);
      trajectory.push(Math.round(currentCapital));
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

export function MonteCarloChart() {
  const INITIAL_CAPITAL = 10000;
  const YEARS = 10;
  const EXPECTED_RETURN = 0.07;
  const VOLATILITY = 0.15;
  const SEED = 1878790276;
  const SPAGHETTI_COUNT = 220; // thin faint paths drawn behind the principal line

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
        INITIAL_CAPITAL,
        YEARS,
        EXPECTED_RETURN,
        VOLATILITY,
        SPAGHETTI_COUNT,
        SEED,
      ),
    [],
  );

  const labels = React.useMemo(
    () => Array.from({ length: YEARS + 1 }, (_, i) => (i === 0 ? "Start" : `Y${i}`)),
    [],
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
              return raw === "Start" ? "Start" : `Year ${raw.replace("Y", "")}`;
            },
            label: (ctx) =>
              `Principal · ${formatFullUsd(Number(ctx.raw))}`,
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
            callback: (value) => formatCompactUsd(Number(value)),
          },
        },
      },
    }),
    [data.datasets.length, ds.surfaceCard, ds.border, ds.textStrong, ds.muted, ds.gridSoft],
  );

  const finalMid = median[YEARS] ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-(--ct-space-3)">
          <div className="flex flex-col gap-(--ct-space-1)">
            <CardTitle>Monte-Carlo projection</CardTitle>
            <CardDescription>
              {formatFullUsd(INITIAL_CAPITAL)} · {YEARS} years · {SPAGHETTI_COUNT} seeded paths
            </CardDescription>
          </div>
          <div className="flex items-center gap-(--ct-space-2) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-2_5) py-(--ct-space-1_5)">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ct-accent)]"
            />
            <span className="ct-metric-caption ct-text-muted">Principal strategy</span>
            <span className="mono text-[length:var(--ct-text-sm)] font-semibold tabular-nums ct-text-strong">
              {formatCompactUsd(finalMid)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[360px] w-full">
          <Line options={options} data={data} />
        </div>
        <p className="mt-(--ct-space-3) ct-metric-caption ct-text-faint">
          Seeded simulation · illustrative dispersion, not guaranteed.
        </p>
      </CardContent>
    </Card>
  );
}
