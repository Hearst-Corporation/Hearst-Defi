"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/catalyst/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/catalyst/chart";
import { cn } from "@/lib/cn";

/**
 * Monte-Carlo spaghetti plot. Hundreds of individual seeded GBM trajectories are
 * drawn thin + faint (accent tints), with ONE bold principal/median path on top.
 * Rendered on the canonical Recharts layer (HC-CHART-001) — the retired Chart.js
 * consumer. Colours reference the live `--ct-*` tokens directly (SVG reads CSS
 * vars), so no runtime token-resolution machinery is needed.
 */

/** Faint accent tints for the spaghetti — a luminance ramp of the SINGLE accent,
 *  expressed as `color-mix` on `--ct-accent` so there is no second green literal
 *  and the whole ramp tracks the DS accent token. */
const SPAGHETTI_TINTS: readonly string[] = [0.18, 0.13, 0.22, 0.1, 0.16].map(
  (a) => `color-mix(in srgb, var(--ct-accent) ${Math.round(a * 100)}%, transparent)`,
);

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

const CHART_CONFIG: ChartConfig = {
  median: { label: "Principal strategy (median)", color: "var(--ct-accent)" },
};

/** Median-only tooltip — the spaghetti is texture, not clickable, so only the
 *  principal path surfaces on hover. */
function MonteCarloTooltip({
  active,
  payload,
  label,
  tooltipLead,
  fullFmt,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number }>;
  label?: unknown;
  tooltipLead: string;
  fullFmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const med = payload.find((p) => p.dataKey === "median");
  if (!med || med.value == null) return null;
  const raw = typeof label === "string" ? label : "";
  const monthLabel = raw === "Start" || raw === "" ? "Start" : `Month ${raw.replace("M", "")}`;
  return (
    <div className="grid min-w-[8rem] gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card px-(--ct-space-2_5) py-(--ct-space-1_5) shadow-[var(--ct-shadow-elevated)]">
      <span className="ct-metric-caption ct-text-strong">{monthLabel}</span>
      <span className="mono text-[length:var(--ct-text-sm)] font-semibold tabular-nums ct-text-strong">
        {tooltipLead} {fullFmt(Number(med.value))}
      </span>
    </div>
  );
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

  // Pivot the trajectories into month-keyed rows {label, median, path0..pathN}
  // — the row shape Recharts LineChart consumes. Each spaghetti path is its own
  // dataKey so it renders as an independent <Line>.
  const rows = React.useMemo(
    () =>
      labels.map((label, i) => {
        const row: Record<string, number | string> = {
          label,
          median: median[i] ?? 0,
        };
        for (let k = 0; k < allTrajectories.length; k++) {
          row[`path${k}`] = allTrajectories[k]?.[i] ?? 0;
        }
        return row;
      }),
    [labels, median, allTrajectories],
  );

  const finalMid = median[months] ?? 0;

  const chart = (
    <ChartContainer
      config={CHART_CONFIG}
      aria-label="Monte-Carlo dispersion of seeded strategy trajectories"
      className="aspect-auto h-full w-full min-w-0"
    >
      <LineChart data={rows} margin={{ left: 4, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="2 5" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          tickCount={6}
          tickFormatter={(v) => compactFmt(Number(v))}
          tick={{ fill: "var(--ct-chart-axis)", fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--ct-border)" }}
          content={<MonteCarloTooltip tooltipLead={tooltipLead} fullFmt={fullFmt} />}
        />
        {allTrajectories.map((_, k) => (
          <Line
            key={k}
            type="monotone"
            dataKey={`path${k}`}
            stroke={SPAGHETTI_TINTS[k % SPAGHETTI_TINTS.length]}
            strokeWidth={0.8}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="median"
          stroke="var(--ct-accent)"
          strokeWidth={2.75}
          dot={false}
          activeDot={{
            r: 4,
            fill: "var(--ct-accent)",
            stroke: "var(--ct-surface-card)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );

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
      <div className={cn("w-full", bare ? "h-[320px]" : "h-[360px]")}>{chart}</div>
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
          <div className="h-[360px] w-full">{chart}</div>
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
