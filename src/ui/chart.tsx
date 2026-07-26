"use client";

// src/ui/chart.tsx — THE performance chart.
//
// One component, one job: plot a real value-over-time series honestly.
//
// WHY A DISCRIMINATED STATE INSTEAD OF `points: T[] | null`
//   An empty array and a failed read are NOT the same fact. "The source
//   answered and there is nothing to plot" (empty) and "the source did not
//   answer" (unavailable) must reach the reader as different sentences — the
//   repo doctrine forbids collapsing them into one grey box, exactly as it
//   forbids rendering an absent figure as `0`.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO
//   - It never fabricates a segment. Fewer than two points is not a trend, so
//     it renders the empty state rather than a line drawn through one dot.
//   - It never baselines the y-axis at 0 (see `buildPerformanceModel`).
//   - It never hardcodes a colour: every stroke/fill/grid reads a token, so the
//     dual `[data-theme]` palette keeps working.
//
// Removed in this pass: `LineChartPanel` / `AreaChartPanel`. Both were dead
// (zero import sites repo-wide) and the area panel carried a STATIC
// linearGradient id — the collision bug this file now fixes with `useId()`.

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/cn";
import type { Provenance } from "@/lib/provenance";
import { ProvenanceBadge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";

// ---------------------------------------------------------------------------
// Tokens — never a literal colour. The palette is dual ([data-theme]); a hex
// here would be right in exactly one theme.
// ---------------------------------------------------------------------------

const CHART_TOKENS = {
  curve: "var(--color-chart-1)",
  grid: "var(--color-chart-grid)",
  axis: "var(--color-subtle)",
} as const;

/**
 * Motion budget. Recharts' default `animationDuration` is 1500 ms — six times
 * the project ceiling (400 ms). `isAnimationActive` is left at its default
 * (`'auto'`) on the series: Recharts already resolves `prefers-reduced-motion`
 * there, and forcing `true` would override a user's accessibility setting.
 */
const ANIMATION_MS = 400;
/**
 * `--ease-standard` is `cubic-bezier(0.2, 0.7, 0.2, 1)` — a decelerating
 * curve. Recharts only accepts the five CSS keywords (no cubic-bezier string),
 * so `ease-out` is the honest nearest match, not a different intent.
 */
const ANIMATION_EASING = "ease-out" as const;

/** Below this, a series is a dot (or a pair of dots), not a trend. */
export const MIN_TREND_POINTS = 2;

// Wording. Kept as constants so the "empty ≠ unavailable" contract is testable
// and can never drift into the same sentence.
const EMPTY_MESSAGE = "No value points recorded yet.";
const SPARSE_MESSAGE =
  "Only one value point so far — a trend needs at least two, so nothing is drawn.";
const UNAVAILABLE_PREFIX = "Series unavailable —";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One sample of the series. `at` accepts a Date, epoch ms, or an ISO string. */
export interface PerformancePoint {
  at: Date | number | string;
  value: number;
}

/**
 * What the chart has been handed. `empty` and `unavailable` are distinct facts
 * and render distinct sentences — see the file header.
 */
export type PerformanceChartState =
  | { kind: "loading" }
  | { kind: "empty"; message?: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; points: PerformancePoint[] };

/** Plot-ready model: sorted numeric rows + both framed domains. */
export interface PerformanceModel {
  rows: Array<{ t: number; v: number }>;
  xDomain: [number, number];
  yDomain: [number, number];
}

export interface PerformanceChartProps {
  state: PerformanceChartState;
  /** Provenance of the series — the badge is part of the chart, not decoration. */
  provenance: Provenance;
  /**
   * Accessible name of the plot. REQUIRED: `role="img"` is only applied when a
   * non-empty label exists — an unlabelled `role="img"` fails the a11y gate,
   * so the component would rather be an anonymous div than a lying landmark.
   */
  ariaLabel: string;
  /** What the y-axis measures, shown as the chart's own title. */
  seriesLabel: string;
  formatValue?: (value: number) => string;
  formatDate?: (epochMs: number) => string;
  height?: number;
  footnote?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

function toEpochMs(at: PerformancePoint["at"]): number {
  if (at instanceof Date) return at.getTime();
  if (typeof at === "number") return at;
  return Date.parse(at);
}

/**
 * Turn raw points into a plot-ready model, or `null` when there is no trend to
 * draw (fewer than {@link MIN_TREND_POINTS} usable points). Pure — exported so
 * the framing rules are testable without a DOM.
 *
 * Y-DOMAIN: framed on the data, padded by 8% of its own span, NEVER anchored
 * to 0. A position that moves from 11.00 to 11.40 against a 0 baseline reads as
 * a dead-flat line — the chart would be drawing a decorative zero instead of
 * the variation the reader came for. (The reconstructed series starts at 0 at
 * subscription anyway, so its own minimum brings the baseline back for free.)
 * A perfectly flat series still gets a symmetric window so it renders as a
 * centred flat line rather than a divide-by-zero.
 *
 * X-DOMAIN: explicit numeric bounds — the axis is a TIME axis, not a category
 * axis. A categorical axis would space missing hourly prints evenly, so a
 * one-day gap would look exactly like a one-hour gap and the SHAPE would lie.
 */
export function buildPerformanceModel(
  points: readonly PerformancePoint[],
): PerformanceModel | null {
  const rows: Array<{ t: number; v: number }> = [];
  for (const p of points) {
    const t = toEpochMs(p.at);
    // A NaN date or a non-finite value is dropped, never coerced to 0 — an
    // unreadable sample is absent data, not a measurement at zero.
    if (!Number.isFinite(t) || !Number.isFinite(p.value)) continue;
    rows.push({ t, v: p.value });
  }
  if (rows.length < MIN_TREND_POINTS) return null;

  rows.sort((a, b) => a.t - b.t);

  const first = rows[0];
  const last = rows[rows.length - 1];
  // Both are defined: the length check above guarantees at least two rows.
  if (!first || !last) return null;

  let min = first.v;
  let max = first.v;
  for (const r of rows) {
    if (r.v < min) min = r.v;
    if (r.v > max) max = r.v;
  }
  const span = max - min;
  const pad = span > 0 ? span * 0.08 : Math.max(Math.abs(max) * 0.02, 1);

  return {
    rows,
    xDomain: [first.t, last.t],
    yDomain: [min - pad, max + pad],
  };
}

// ---------------------------------------------------------------------------
// Default formatters — module constants, so their identity is stable across
// renders (a fresh arrow per render would defeat the tooltip memoisation).
// ---------------------------------------------------------------------------

const valueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const axisDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const defaultFormatValue = (value: number): string => valueFormatter.format(value);
const defaultFormatDate = (epochMs: number): string =>
  axisDateFormatter.format(new Date(epochMs));
const defaultFormatTooltipDate = (epochMs: number): string =>
  `${tooltipDateFormatter.format(new Date(epochMs))} UTC`;

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipRenderProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string }>;
}

function PerformanceTooltip({
  active,
  label,
  payload,
  seriesLabel,
  formatValue,
  formatDate,
}: TooltipRenderProps & {
  seriesLabel: string;
  formatValue: (value: number) => string;
  formatDate: (epochMs: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const at = typeof label === "number" ? label : Number(label);

  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs shadow-[var(--ct-shadow-soft)]">
      {Number.isFinite(at) ? (
        <p className="mb-1 text-subtle">{formatDate(at)}</p>
      ) : null}
      <p className="font-medium text-foreground tabular-nums">
        {seriesLabel}: {formatValue(raw)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerformanceChart({
  state,
  provenance,
  ariaLabel,
  seriesLabel,
  formatValue,
  formatDate,
  height = 260,
  footnote,
  className,
}: PerformanceChartProps) {
  // Gradient id scoped per instance. A static id collides the moment two charts
  // share a page: SVG resolves `url(#id)` against the FIRST match in the
  // document, so instance B silently paints with instance A's gradient.
  const instanceId = useId();
  const gradientId = `perf-area-${instanceId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const points = state.kind === "ready" ? state.points : null;
  // The only modelling pass: parse, sort, frame. Recomputed only when the
  // points array identity changes, not on every mousemove.
  const model = useMemo(
    () => (points ? buildPerformanceModel(points) : null),
    [points],
  );

  const valueFmt = formatValue ?? defaultFormatValue;
  const axisDateFmt = formatDate ?? defaultFormatDate;
  const tooltipDateFmt = formatDate ?? defaultFormatTooltipDate;

  // Both memoised: Recharts re-renders the tooltip on every pointer move, and a
  // fresh element/object each time forces a full remount of the tooltip subtree.
  const tooltipContent = useMemo(
    () => (
      <PerformanceTooltip
        seriesLabel={seriesLabel}
        formatValue={valueFmt}
        formatDate={tooltipDateFmt}
      />
    ),
    [seriesLabel, valueFmt, tooltipDateFmt],
  );
  const tooltipCursor = useMemo(
    () => ({ stroke: CHART_TOKENS.grid, strokeWidth: 1 }),
    [],
  );
  const axisTick = useMemo(
    () => ({ fill: CHART_TOKENS.axis, fontSize: 11 }),
    [],
  );

  // A `ready` state whose points do not make a trend degrades to `empty` — the
  // source DID answer, it just has not accumulated enough history yet.
  const mode: "loading" | "empty" | "unavailable" | "ready" =
    state.kind === "ready" ? (model ? "ready" : "empty") : state.kind;

  const labelled = typeof ariaLabel === "string" && ariaLabel.trim().length > 0;

  let body: React.ReactNode;
  if (mode === "loading") {
    body = (
      <div style={{ height }}>
        <Skeleton className="h-full w-full" />
        <span className="sr-only">Loading {seriesLabel}…</span>
      </div>
    );
  } else if (mode === "unavailable") {
    // `reason` is the source's own words — never rewritten into a friendlier
    // sentence that would hide which read failed.
    const reason = state.kind === "unavailable" ? state.reason : "";
    body = (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-dashed border-border-subtle px-4 text-center"
      >
        <p className="text-sm text-subtle">
          {UNAVAILABLE_PREFIX} {reason}
        </p>
      </div>
    );
  } else if (mode === "empty") {
    const message =
      state.kind === "empty"
        ? (state.message ?? EMPTY_MESSAGE)
        : SPARSE_MESSAGE; // ready-but-sparse
    body = (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-border-subtle px-4 text-center"
      >
        <p className="text-sm text-subtle">{message}</p>
      </div>
    );
  } else {
    const plot = model as PerformanceModel;
    body = (
      <div
        style={{ height }}
        data-chart-surface=""
        data-gradient-id={gradientId}
        {...(labelled ? { role: "img" as const, "aria-label": ariaLabel } : {})}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 640, height }}
        >
          <AreaChart
            data={plot.rows}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_TOKENS.curve} stopOpacity={0.28} />
                <stop offset="55%" stopColor={CHART_TOKENS.curve} stopOpacity={0.08} />
                <stop offset="100%" stopColor={CHART_TOKENS.curve} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_TOKENS.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={plot.xDomain}
              tickFormatter={axisDateFmt}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              dataKey="v"
              domain={plot.yDomain}
              tickFormatter={valueFmt}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            {/* isAnimationActive={false} HERE ONLY: Recharts' tooltip box carries
                a 400 ms `transition: transform`, which reads as tooltip lag. The
                series keeps its default 'auto' so prefers-reduced-motion wins. */}
            <Tooltip
              isAnimationActive={false}
              content={tooltipContent}
              cursor={tooltipCursor}
            />
            {/* `monotone` is the only smoothing that never overshoots the data —
                a spline that arcs above a real high would invent a value that
                was never printed. */}
            <Area
              type="monotone"
              dataKey="v"
              name={seriesLabel}
              stroke={CHART_TOKENS.curve}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, fill: CHART_TOKENS.curve }}
              animationDuration={ANIMATION_MS}
              animationEasing={ANIMATION_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      data-chart-state={mode}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{seriesLabel}</p>
        <ProvenanceBadge source={provenance} />
      </div>
      {body}
      {footnote ? <p className="text-xs text-subtle">{footnote}</p> : null}
    </div>
  );
}
