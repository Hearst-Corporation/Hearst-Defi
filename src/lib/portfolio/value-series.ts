/**
 * Portfolio value chart — time-series types and builder.
 *
 * Primary path: hourly NAV snapshots (`hourlySnapshots`) when the backend
 * supplies them. Fallback: ledger step reconstruction from investor
 * transactions — honest, sparse, never decorative.
 */

export type ValueSeriesTx = {
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
};

/** UI range toggles — window filter applied before projection. */
export type ChartTimeRange = "24h" | "7d" | "30d" | "all";

export type ValueSeriesPointSource = "hourly_snapshot" | "ledger_step" | "live_anchor";

export interface ValueSeriesPoint {
  at: Date;
  valueUsdc: number;
  source: ValueSeriesPointSource;
  isDistribution?: boolean;
}

/** Future / optional feed: one NAV print per hour (or finer). */
export interface HourlyValueSnapshot {
  at: Date;
  valueUsdc: number;
}

export interface BuiltPortfolioValueSeries {
  points: ValueSeriesPoint[];
  range: ChartTimeRange;
  /** `hourly` when snapshot feed is present; otherwise ledger reconstruction. */
  mode: "hourly" | "ledger_sparse";
  densityNote: string;
  windowStart: Date;
  windowEnd: Date;
}

const HOUR_MS = 60 * 60 * 1000;

const RANGE_MS: Record<Exclude<ChartTimeRange, "all">, number> = {
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS,
};

/** "All" tuning: floor so a same-day position still draws a line; bounded fallback
   lookback when no inception is known (never an empty year of flat zero). */
const ALL_MIN_SPAN_MS = 24 * HOUR_MS;
const ALL_FALLBACK_MS = 365 * 24 * HOUR_MS;

/**
 * Window bounds for a range. For "all", anchor the start at `inception` (the first
 * event) so the chart never shows a long flat-zero prefix from before the position
 * existed — "all" means the investor's whole history, not a fixed 12-month box.
 */
export function chartWindowBounds(
  now: Date,
  range: ChartTimeRange,
  inception?: Date | null,
): { start: Date; end: Date } {
  const end = now;
  if (range === "all") {
    if (inception && inception.getTime() < end.getTime()) {
      const span = Math.max(end.getTime() - inception.getTime(), ALL_MIN_SPAN_MS);
      const pad = span * 0.06; // small breathing room left of the first step
      return { start: new Date(end.getTime() - span - pad), end };
    }
    return { start: new Date(end.getTime() - ALL_FALLBACK_MS), end };
  }
  return { start: new Date(end.getTime() - RANGE_MS[range]), end };
}

/** Earliest event timestamp across ledger txs + hourly snapshots (inception anchor). */
function earliestEventDate(
  transactions: ValueSeriesTx[],
  hourlySnapshots?: HourlyValueSnapshot[],
): Date | null {
  let min: number | null = null;
  for (const tx of transactions) {
    const t = tx.occurredAt.getTime();
    if (min === null || t < min) min = t;
  }
  for (const s of hourlySnapshots ?? []) {
    const t = s.at.getTime();
    if (min === null || t < min) min = t;
  }
  return min === null ? null : new Date(min);
}

function sortPoints(points: ValueSeriesPoint[]): ValueSeriesPoint[] {
  return [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
}

function dedupeByTimestamp(points: ValueSeriesPoint[]): ValueSeriesPoint[] {
  const byTs = new Map<number, ValueSeriesPoint>();
  for (const p of points) {
    byTs.set(p.at.getTime(), p);
  }
  return sortPoints([...byTs.values()]);
}

function buildFromHourlySnapshots(
  snapshots: HourlyValueSnapshot[],
  totalValueUsdc: number,
  windowStart: Date,
  windowEnd: Date,
): ValueSeriesPoint[] {
  const inWindow = snapshots
    .filter((s) => s.at >= windowStart && s.at <= windowEnd)
    .map(
      (s): ValueSeriesPoint => ({
        at: s.at,
        valueUsdc: s.valueUsdc,
        source: "hourly_snapshot",
      }),
    );

  const points = dedupeByTimestamp(inWindow);

  // Carry the earliest known NAV flat back to windowStart so the line spans the
  // whole window instead of being stranded against the right edge when the feed
  // only covers part of the range (e.g. 7 days of prints in a 30D / ALL window).
  // A flat carry-back is the honest estimate for a period we have no prints for
  // — NEVER a fabricated trend, and never a distribution "cliff" (a payout is
  // cash received by the investor, not portfolio value lost).
  const first = points[0];
  if (first && first.at.getTime() - windowStart.getTime() > HOUR_MS) {
    points.unshift({
      at: windowStart,
      valueUsdc: first.valueUsdc,
      source: "hourly_snapshot",
    });
  }

  const last = points[points.length - 1];
  const needsLiveAnchor =
    !last || Math.abs(windowEnd.getTime() - last.at.getTime()) > HOUR_MS / 2;

  if (needsLiveAnchor) {
    points.push({
      at: windowEnd,
      valueUsdc: totalValueUsdc,
      source: "live_anchor",
    });
  } else if (last) {
    last.valueUsdc = totalValueUsdc;
    last.source = "live_anchor";
  }

  return points;
}

/**
 * Ledger step reconstruction — walks transactions backward from the live NAV.
 * Emits before/after steps at each event (same semantics as legacy projection).
 */
function buildFromLedger(
  transactions: ValueSeriesTx[],
  totalValueUsdc: number,
  windowStart: Date,
  windowEnd: Date,
): ValueSeriesPoint[] {
  const sortedTxs = [...transactions]
    .filter((tx) => tx.occurredAt >= windowStart && tx.occurredAt <= windowEnd)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const raw: {
    at: Date;
    valueUsdc: number;
    isDistribution?: boolean;
    phase: number;
  }[] = [];

  let currentValue = totalValueUsdc;
  raw.push({ at: windowEnd, valueUsdc: currentValue, phase: 0 });

  for (let i = sortedTxs.length - 1; i >= 0; i--) {
    const tx = sortedTxs[i]!;

    raw.push({ at: tx.occurredAt, valueUsdc: currentValue, phase: 1 });

    if (tx.type === "deposit") {
      currentValue -= tx.amountUsdc;
    } else if (tx.type === "withdraw") {
      currentValue += tx.amountUsdc;
    } else if (tx.type === "distribution" || tx.type === "claim") {
      currentValue += tx.amountUsdc;
    }

    raw.push({
      at: tx.occurredAt,
      valueUsdc: currentValue,
      isDistribution: tx.type === "distribution",
      phase: 0,
    });
  }

  raw.push({ at: windowStart, valueUsdc: currentValue, phase: 0 });

  return raw
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.phase - b.phase)
    .map(
      (p): ValueSeriesPoint => ({
        at: p.at,
        valueUsdc: p.valueUsdc,
        source: p.at.getTime() === windowEnd.getTime() ? "live_anchor" : "ledger_step",
        isDistribution: p.isDistribution,
      }),
    );
}

function densityNoteFor(mode: BuiltPortfolioValueSeries["mode"], pointCount: number, range: ChartTimeRange): string {
  if (mode === "hourly") {
    return pointCount >= 2 ? "Hourly NAV prints" : "Awaiting hourly prints";
  }
  if (pointCount <= 2) {
    return range === "24h" ? "Live NAV only — hourly history pending" : "Sparse ledger — event anchors only";
  }
  return "Ledger-based — event anchors";
}

/**
 * Build the portfolio value time series for charting.
 *
 * @param hourlySnapshots — when provided, drives hourly (or finer) density.
 *   Wired from DB/API when investor NAV snapshots land; empty today.
 */
export function buildPortfolioValueSeries(args: {
  transactions: ValueSeriesTx[];
  totalValueUsdc: number;
  now?: Date;
  range: ChartTimeRange;
  hourlySnapshots?: HourlyValueSnapshot[];
}): BuiltPortfolioValueSeries {
  const now = args.now ?? new Date();
  const inception = earliestEventDate(args.transactions, args.hourlySnapshots);
  const { start: windowStart, end: windowEnd } = chartWindowBounds(
    now,
    args.range,
    inception,
  );

  const hasHourly =
    args.hourlySnapshots != null && args.hourlySnapshots.length > 0;

  const points = hasHourly
    ? buildFromHourlySnapshots(
        args.hourlySnapshots!,
        args.totalValueUsdc,
        windowStart,
        windowEnd,
      )
    : buildFromLedger(
        args.transactions,
        args.totalValueUsdc,
        windowStart,
        windowEnd,
      );

  const mode = hasHourly ? "hourly" : "ledger_sparse";

  return {
    points,
    range: args.range,
    mode,
    densityNote: densityNoteFor(mode, points.length, args.range),
    windowStart,
    windowEnd,
  };
}

/** Expected minimum cadence for a healthy hourly feed (ms). */
export const PORTFOLIO_VALUE_HOURLY_CADENCE_MS = HOUR_MS;

// ── Chart presentation helpers ────────────────────────────────────────────────
// Pure, deterministic, no I/O. These drive the hero chart's header + axis so the
// subtitle can NEVER claim "12 months" while the x-axis shows a few days, and so
// the chart honestly labels its own time window from the real point dates.
//
// Pattern absorbed (not copied) from the reference TimeSeriesChart: an explicit
// padding model, niceTicks-style rounded value steps, and a single formatValue.
// No external colours, no campaign/business logic, no third-party convention.

const DAY_MS = 24 * HOUR_MS;

/** Below this balance the account is a seed, not a mature institutional book. */
export const PORTFOLIO_SEED_BALANCE_USDC = 1_000;

export type PortfolioChartGranularity = "daily" | "monthly" | "empty";

export interface PortfolioChartTick {
  /** Index into the (filtered) point series the tick belongs to. */
  index: number;
  label: string;
}

export interface ResolvedPortfolioChartWindow {
  /** Header subtitle, always coherent with the real span (never "12 months" for days). */
  subtitle: string;
  /** Window granularity, drives x-axis label format. */
  granularity: PortfolioChartGranularity;
  /** 4–6 x-axis ticks spread across the series, labelled for the granularity. */
  xTicks: PortfolioChartTick[];
  /** Days spanned by the series (0 when <2 points). */
  spanDays: number;
  /** True only when the data is genuinely live (real source AND a real span). */
  isLive: boolean;
  /** True when the chart is rendering fallback / mock data. */
  isDemo: boolean;
  /** True when the latest value is at or below the seed-balance threshold. */
  isLowBalance: boolean;
}

/**
 * Format a USDC value for the chart (header metric + y-axis ticks).
 *   0 → "$0"   ·   11 → "$11"   ·   11.2 → "$11.20"
 *   11_200 → "$11.2K"   ·   11_200_000 → "$11.2M"   ·   1_120_000_000 → "$1.1B"
 * Whole dollars under $1k print without decimals; cents print with two.
 */
export function formatPortfolioCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const neg = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}K`;
  else if (Number.isInteger(abs)) body = `${abs}`;
  else body = abs.toFixed(2);
  return `${neg ? "-" : ""}$${body}`;
}

/** Date → tick label, formatted for the resolved granularity. */
export function formatChartDateTick(
  at: Date | number | string,
  granularity: PortfolioChartGranularity,
): string {
  const d = at instanceof Date ? at : new Date(at);
  if (granularity === "monthly") {
    return d.toLocaleDateString("en-US", { month: "short" });
  }
  // daily / empty → "Jun 24"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Evenly-spread tick indices across a series of `len` points (4–6 ticks). */
function spreadTickIndices(len: number): number[] {
  if (len <= 1) return len === 1 ? [0] : [];
  const target = Math.min(6, Math.max(2, len));
  const last = len - 1;
  const out = new Set<number>();
  for (let i = 0; i < target; i++) {
    out.add(Math.round((i / (target - 1)) * last));
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Resolve everything the hero chart header + axis need from the real series.
 * The subtitle and x-axis granularity are derived from the actual span so they
 * can never disagree.
 *
 * @param points  the real value series (≥0 points)
 * @param source  loader truth — "live" plots as live, "fallback" plots as demo
 */
export function resolvePortfolioChartWindow(
  points: readonly { at: Date | number | string; value: number }[],
  source: "live" | "fallback",
): ResolvedPortfolioChartWindow {
  const isDemo = source === "fallback";

  if (points.length < 2) {
    return {
      subtitle: "Net asset value · awaiting history",
      granularity: "empty",
      xTicks: [],
      spanDays: 0,
      isLive: false,
      isDemo,
      isLowBalance: false,
    };
  }

  const firstAt = points[0]!.at;
  const lastAt = points[points.length - 1]!.at;
  const toMs = (a: Date | number | string): number =>
    (a instanceof Date ? a : new Date(a)).getTime();
  const spanDays = Math.max(0, (toMs(lastAt) - toMs(firstAt)) / DAY_MS);

  // ≥ ~10 weeks of history reads as a trailing-months view; below that the axis
  // is day-precise (otherwise every tick collapses to the same month name).
  const granularity: PortfolioChartGranularity = spanDays >= 70 ? "monthly" : "daily";

  let subtitle: string;
  if (granularity === "monthly") {
    const months = Math.round(spanDays / 30);
    subtitle =
      months >= 12
        ? "Net asset value · trailing 12 months"
        : `Net asset value · trailing ${months} months`;
  } else if (spanDays >= 1) {
    const days = Math.max(1, Math.round(spanDays));
    subtitle = `Net asset value · last ${days} days`;
  } else {
    subtitle = "Net asset value · latest activity window";
  }

  const xTicks: PortfolioChartTick[] = spreadTickIndices(points.length).map(
    (index) => ({
      index,
      label: formatChartDateTick(points[index]!.at, granularity),
    }),
  );

  const latestValue = points[points.length - 1]!.value;
  const isLowBalance = latestValue <= PORTFOLIO_SEED_BALANCE_USDC;
  // Live only when real-sourced AND there is a genuine span to plot.
  const isLive = !isDemo && spanDays > 0;

  return {
    subtitle,
    granularity,
    xTicks,
    spanDays,
    isLive,
    isDemo,
    isLowBalance,
  };
}
