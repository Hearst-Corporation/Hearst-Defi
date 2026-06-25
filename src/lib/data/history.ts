// NOTE: deliberately NOT `server-only`. This module is isomorphic (only `fetch`
// + pure math, no prisma/fs/secrets) so the `tsx` backfill script can import it.
//
// Historical market series for the 36-month backfill. Hybrid by design: try the
// free public APIs (CoinGecko daily prices, mempool.space difficulty steps) and
// fall back to a deterministic synthetic series when they fail or rate-limit, so
// the backfill is always reproducible and never blocks on an upstream outage.
//
// All numbers are *daily*. Difficulty (which only steps ~every 2 weeks) is
// forward-filled across days.

export type HistorySource = "api" | "synthetic";

export interface DailyValue {
  /** UTC midnight of the day. */
  date: Date;
  value: number;
}

export interface DailyMarketPoint {
  date: Date;
  btcUsd: number;
  difficulty: number;
}

export interface MarketHistory {
  points: DailyMarketPoint[];
  btcSource: HistorySource;
  difficultySource: HistorySource;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Inclusive list of UTC days from `start` to `end`. */
export function eachUtcDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfUtcDay(start).getTime();
  const last = startOfUtcDay(end).getTime();
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor += DAY_MS;
  }
  return days;
}

/** Deterministic pseudo-random in [0, 1) from an integer seed (mulberry32). */
function det(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// ---------------------------------------------------------------------------
// Synthetic series (deterministic — used as fallback and as a backstop for gaps)
// ---------------------------------------------------------------------------

const BTC_START_USD = 30_000;
const BTC_END_USD = 100_000;
const DIFFICULTY_START = 4.5e13;
const DIFFICULTY_END = 1.32e14;

/** Shared builder for deterministic synthetic series. */
function buildSyntheticSeries(
  start: Date,
  end: Date,
  params: {
    startVal: number;
    endVal: number;
    noiseScale: number;
    noiseSeed?: number;
    cycle?: (t: number) => number;
    round?: boolean;
  },
): DailyValue[] {
  const days = eachUtcDay(start, end);
  const n = Math.max(1, days.length - 1);
  return days.map((date, i) => {
    const t = i / n;
    const trend =
      params.startVal + (params.endVal - params.startVal) * smoothstep(t);
    const cycle = params.cycle ? params.cycle(t) : 1;
    const seed = params.noiseSeed
      ? Math.floor(date.getTime() / DAY_MS) ^ params.noiseSeed
      : Math.floor(date.getTime() / DAY_MS);
    const noise = 1 + (det(seed) - 0.5) * params.noiseScale;
    const val = trend * cycle * noise;
    return {
      date,
      value: params.round ? Math.max(1, Math.round(val)) : val,
    };
  });
}

/** Plausible deterministic BTC price path across [start, end]. */
export function syntheticBtcSeries(start: Date, end: Date): DailyValue[] {
  return buildSyntheticSeries(start, end, {
    startVal: BTC_START_USD,
    endVal: BTC_END_USD,
    noiseScale: 0.06,
    cycle: (t) => 1 + 0.14 * Math.sin(t * Math.PI * 2 * 1.5),
    round: true,
  });
}

/** Plausible deterministic, broadly-increasing difficulty path. */
export function syntheticDifficultySeries(start: Date, end: Date): DailyValue[] {
  return buildSyntheticSeries(start, end, {
    startVal: DIFFICULTY_START,
    endVal: DIFFICULTY_END,
    noiseScale: 0.03,
    noiseSeed: 0x1234,
    round: false,
  });
}

// ---------------------------------------------------------------------------
// Parsers (pure — never throw, return null on shape mismatch)
// ---------------------------------------------------------------------------

/** Parses CoinGecko `/market_chart` → daily {date, price}. */
export function parseCoingeckoMarketChart(json: unknown): DailyValue[] | null {
  if (typeof json !== "object" || json === null) return null;
  const prices = (json as Record<string, unknown>).prices;
  if (!Array.isArray(prices)) return null;

  const byDay = new Map<number, number>();
  for (const entry of prices) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [ms, price] = entry;
    if (typeof ms !== "number" || typeof price !== "number") continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    byDay.set(startOfUtcDay(new Date(ms)).getTime(), price); // last wins
  }
  if (byDay.size === 0) return null;
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, value]) => ({ date: new Date(ms), value }));
}

/** Parses mempool.space `/mining/difficulty-adjustments/[interval]` → steps. */
export function parseMempoolDifficultyAdjustments(
  json: unknown,
): DailyValue[] | null {
  if (!Array.isArray(json)) return null;
  const steps: DailyValue[] = [];
  for (const tuple of json) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue;
    const [tsSeconds, , difficulty] = tuple;
    if (typeof tsSeconds !== "number" || typeof difficulty !== "number") continue;
    if (!Number.isFinite(difficulty) || difficulty <= 0) continue;
    steps.push({ date: startOfUtcDay(new Date(tsSeconds * 1000)), value: difficulty });
  }
  if (steps.length === 0) return null;
  return steps.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------------------
// Merge: align BTC + (forward-filled) difficulty onto every day in the range
// ---------------------------------------------------------------------------

export function mergeDailyHistory(
  days: Date[],
  btc: DailyValue[],
  difficulty: DailyValue[],
): DailyMarketPoint[] {
  const btcByDay = new Map(btc.map((p) => [p.date.getTime(), p.value]));
  const diffSorted = [...difficulty].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Synthetic backstops so a gap in real data never yields NaN.
  const span = days.length > 0 ? days : [new Date()];
  const synthBtc = new Map(
    syntheticBtcSeries(span[0]!, span[span.length - 1]!).map((p) => [
      p.date.getTime(),
      p.value,
    ]),
  );
  const synthDiff = syntheticDifficultySeries(
    span[0]!,
    span[span.length - 1]!,
  );

  let lastBtc = 0;
  let diffIdx = 0;
  let lastDiff = 0;

  return days.map((date, i) => {
    const ms = date.getTime();

    const btcVal = btcByDay.get(ms);
    if (btcVal !== undefined) lastBtc = btcVal;
    const btcUsd = lastBtc > 0 ? lastBtc : (synthBtc.get(ms) ?? BTC_START_USD);

    while (
      diffIdx < diffSorted.length &&
      diffSorted[diffIdx]!.date.getTime() <= ms
    ) {
      lastDiff = diffSorted[diffIdx]!.value;
      diffIdx++;
    }
    const difficultyVal =
      lastDiff > 0 ? lastDiff : synthDiff[Math.min(i, synthDiff.length - 1)]!.value;

    return { date, btcUsd, difficulty: difficultyVal };
  });
}

// ---------------------------------------------------------------------------
// Network fetchers (never throw — fall back to synthetic)
// ---------------------------------------------------------------------------

const COINGECKO_MARKET_CHART = (days: number) =>
  `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;

/** mempool window param closest to (and covering) the requested months. */
function mempoolInterval(months: number): string {
  if (months <= 1) return "1m";
  if (months <= 3) return "3m";
  if (months <= 6) return "6m";
  if (months <= 12) return "1y";
  if (months <= 24) return "2y";
  return "3y";
}

async function fetchBtcDaily(
  days: Date[],
): Promise<{ series: DailyValue[]; source: HistorySource }> {
  try {
    const res = await fetch(COINGECKO_MARKET_CHART(days.length), {
      next: { revalidate: 86_400 },
    });
    if (res.ok) {
      const parsed = parseCoingeckoMarketChart(await res.json());
      // Require meaningful coverage; otherwise the synthetic series is better.
      if (parsed && parsed.length >= Math.min(days.length, 90)) {
        return { series: parsed, source: "api" };
      }
    }
  } catch {
    // fall through to synthetic
  }
  const start = days[0] ?? new Date();
  const end = days[days.length - 1] ?? new Date();
  return { series: syntheticBtcSeries(start, end), source: "synthetic" };
}

async function fetchDifficulty(
  months: number,
  days: Date[],
): Promise<{ series: DailyValue[]; source: HistorySource }> {
  try {
    const url = `https://mempool.space/api/v1/mining/difficulty-adjustments/${mempoolInterval(months)}`;
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (res.ok) {
      const parsed = parseMempoolDifficultyAdjustments(await res.json());
      if (parsed && parsed.length >= 2) {
        return { series: parsed, source: "api" };
      }
    }
  } catch {
    // fall through to synthetic
  }
  const start = days[0] ?? new Date();
  const end = days[days.length - 1] ?? new Date();
  return { series: syntheticDifficultySeries(start, end), source: "synthetic" };
}

/**
 * Builds `months` of daily market history ending at `endDate` (default: today),
 * fetching real data where possible and filling the rest deterministically.
 */
export async function buildMarketHistory(opts: {
  months: number;
  endDate?: Date;
}): Promise<MarketHistory> {
  const end = startOfUtcDay(opts.endDate ?? new Date());
  const start = startOfUtcDay(
    new Date(end.getTime() - opts.months * 30 * DAY_MS),
  );
  const days = eachUtcDay(start, end);

  const [btc, difficulty] = await Promise.all([
    fetchBtcDaily(days),
    fetchDifficulty(opts.months, days),
  ]);

  return {
    points: mergeDailyHistory(days, btc.series, difficulty.series),
    btcSource: btc.source,
    difficultySource: difficulty.source,
  };
}
