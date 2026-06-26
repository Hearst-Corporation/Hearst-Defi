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
