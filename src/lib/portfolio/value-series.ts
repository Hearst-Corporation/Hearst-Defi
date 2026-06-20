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

/**
 * Twelve month-end points ending at `asOf`. Uses txn anchors + live terminal value.
 */
export function buildPortfolioValueSeries(
  transactions: ValueSeriesTx[],
  currentValueUsdc: number,
  asOf: Date = new Date(),
  monthCount = 12,
): PortfolioValuePoint[] {
  const anchors = buildAnchors(transactions, currentValueUsdc, asOf);
  const points: PortfolioValuePoint[] = [];

  for (let i = 0; i < monthCount; i++) {
    const monthOffset = -(monthCount - 1 - i);
    const monthStart = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthOffset, 1),
    );
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

    points.push({
      label: MONTH_LABELS[monthStart.getUTCMonth() % 12] ?? "",
      value: Math.max(0, interpolateAt(anchors, monthEnd.getTime())),
      isDistribution: monthHadDistribution(transactions, monthStart, monthEnd),
    });
  }

  return points;
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
      isDistribution: i > 0,
    });
  }

  return points;
}
