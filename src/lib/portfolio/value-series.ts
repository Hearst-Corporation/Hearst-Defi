/**
 * Portfolio value chart series — built from investor ledger transactions.
 *
 * Pure function: no I/O. Anchors the terminal point to the live mark
 * (principal + accrued). Intermediate months interpolate between txn anchors.
 */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export type ValueSeriesTx = {
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
};

export type PortfolioValuePoint = {
  label: string;
  value: number;
  isDistribution: boolean;
};

type Anchor = { t: number; value: number };

function applyTx(running: number, tx: ValueSeriesTx): number {
  const amt = tx.amountUsdc;
  switch (tx.type) {
    case "deposit":
      return running + amt;
    case "withdraw":
      return Math.max(0, running - amt);
    case "distribution":
    case "claim":
      return Math.max(0, running - amt);
    default:
      return running;
  }
}

function buildAnchors(
  transactions: ValueSeriesTx[],
  currentValueUsdc: number,
  asOf: Date,
): Anchor[] {
  const sorted = [...transactions].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const anchors: Anchor[] = [];
  let running = 0;

  for (const tx of sorted) {
    running = applyTx(running, tx);
    anchors.push({ t: tx.occurredAt.getTime(), value: running });
  }

  const asOfT = asOf.getTime();
  const last = anchors[anchors.length - 1];
  if (!last || last.t !== asOfT || last.value !== currentValueUsdc) {
    anchors.push({ t: asOfT, value: currentValueUsdc });
  } else {
    last.value = currentValueUsdc;
  }

  return anchors;
}

function interpolateAt(anchors: Anchor[], time: number): number {
  if (anchors.length === 0) return 0;
  if (time <= anchors[0]!.t) return anchors[0]!.value;
  const last = anchors[anchors.length - 1]!;
  if (time >= last.t) return last.value;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (time >= a.t && time <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return b.value;
      const frac = (time - a.t) / span;
      return Math.round(a.value + (b.value - a.value) * frac);
    }
  }

  return last.value;
}

function monthHadDistribution(
  transactions: ValueSeriesTx[],
  monthStart: Date,
  monthEnd: Date,
): boolean {
  return transactions.some(
    (tx) =>
      (tx.type === "distribution" || tx.type === "claim") &&
      tx.occurredAt >= monthStart &&
      tx.occurredAt <= monthEnd,
  );
}

/** UTC timestamp of the first day of the month containing `date`. */
function monthStartOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/**
 * Month-end points ending at `asOf`, spanning at most `monthCount` months.
 *
 * The window starts at the LATER of (asOf − monthCount) and the month of the
 * first real transaction: we never draw a flat pre-deposit history that didn't
 * exist. A brand-new single deposit yields a short honest window (deposit month
 * → asOf), not 11 flat months plus a terminal spike.
 */
export function buildPortfolioValueSeries(
  transactions: ValueSeriesTx[],
  currentValueUsdc: number,
  asOf: Date = new Date(),
  monthCount = 12,
): PortfolioValuePoint[] {
  const anchors = buildAnchors(transactions, currentValueUsdc, asOf);

  // Floor the window at the first transaction's month — no invented pre-history.
  const firstTxT = transactions.reduce(
    (min, tx) => Math.min(min, tx.occurredAt.getTime()),
    Number.POSITIVE_INFINITY,
  );
  const fullWindowStart = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth() - (monthCount - 1),
    1,
  );
  let windowStart = Number.isFinite(firstTxT)
    ? Math.max(fullWindowStart, monthStartOf(new Date(firstTxT)))
    : fullWindowStart;

  // Guarantee at least 2 points so a line (not a lone dot) renders: if the
  // first deposit lands in asOf's own month, include the prior month too.
  const asOfMonthStart = monthStartOf(asOf);
  if (windowStart >= asOfMonthStart) {
    windowStart = Math.max(
      fullWindowStart,
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1),
    );
  }

  const points: PortfolioValuePoint[] = [];

  for (let i = 0; i < monthCount; i++) {
    const monthOffset = -(monthCount - 1 - i);
    const monthStart = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthOffset, 1),
    );
    // Skip months that predate the first real transaction.
    if (monthStart.getTime() < windowStart) continue;

    const monthEnd =
      monthOffset === 0
        ? asOf
        : new Date(
            Date.UTC(
              monthStart.getUTCFullYear(),
              monthStart.getUTCMonth() + 1,
              0,
              23,
              59,
              59,
              999,
            ),
          );

    // Months whose end predates the first transaction are honestly $0 — the
    // portfolio did not exist yet. Without this, a single fresh deposit reads as
    // a flat line at the deposit value across the back-filled prior month
    // (invented pre-history), leaving the chart half-empty. Zeroing it makes the
    // curve rise from $0 → current value, which is both truthful and legible.
    const monthEndT = monthEnd.getTime();
    const value =
      Number.isFinite(firstTxT) && monthEndT < firstTxT
        ? 0
        : Math.max(0, interpolateAt(anchors, monthEndT));

    points.push({
      label: MONTH_LABELS[monthStart.getUTCMonth() % 12] ?? "",
      value,
      isDistribution: monthHadDistribution(transactions, monthStart, monthEnd),
    });
  }

  return points;
}

/**
 * APY-band projection series for the zero-state preview chart.
 *
 * Projects `baseUsdc` forward using compounded monthly growth derived from
 * `apyLow` and `apyHigh`, producing two series (low-band, high-band) over
 * `months` steps. Returns points suitable for a twin-line preview render.
 *
 * Pure function — no I/O. `baseUsdc` is passed from the caller (the $250k
 * illustrative ticket lives in presentation, not here).
 */
export function buildApyProjectionSeries(
  baseUsdc: number,
  apyLow: number,
  apyHigh: number,
  asOf: Date,
  months: number = 12,
): { low: PortfolioValuePoint[]; high: PortfolioValuePoint[] } {
  const base = Math.max(0, baseUsdc);
  const rLow = apyLow / 100 / 12;
  const rHigh = apyHigh / 100 / 12;
  const low: PortfolioValuePoint[] = [];
  const high: PortfolioValuePoint[] = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (months - 1 - i), 1),
    );
    const label = MONTH_LABELS[d.getUTCMonth() % 12] ?? "";
    low.push({
      label,
      value: Math.round(base * Math.pow(1 + rLow, i)),
      isDistribution: false,
    });
    high.push({
      label,
      value: Math.round(base * Math.pow(1 + rHigh, i)),
      isDistribution: false,
    });
  }

  return { low, high };
}

/**
 * Fallback when no txn history exists: linear principal → current value (no synthetic wave).
 */
export function buildIndicativeValueSeries(
  startValueUsdc: number,
  endValueUsdc: number,
  asOf: Date = new Date(),
  monthCount = 12,
): PortfolioValuePoint[] {
  const start = Math.max(0, startValueUsdc);
  const end = Math.max(0, endValueUsdc);
  const points: PortfolioValuePoint[] = [];

  for (let i = 0; i < monthCount; i++) {
    const monthOffset = -(monthCount - 1 - i);
    const d = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthOffset, 1),
    );
    const t = monthCount === 1 ? 1 : i / (monthCount - 1);
    points.push({
      label: MONTH_LABELS[d.getUTCMonth() % 12] ?? "",
      value: Math.round(start + (end - start) * t),
      isDistribution: false,
    });
  }

  return points;
}
