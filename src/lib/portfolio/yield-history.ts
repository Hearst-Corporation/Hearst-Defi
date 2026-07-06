/**
 * yield-history — deterministic monthly distribution series for one position.
 *
 * PURE (no I/O, no PRNG, clock injected). Folds the position's real
 * distribution transactions into a month-by-month REALIZED series, then appends
 * a forward PROJECTION (principal × APY-range / 12 per month) from now to
 * maturity. Realized months are Attested; projected months are an honest
 * low→high RANGE, never a single point, never dressed as paid. Powers the Yield
 * History section (stat band + distribution chart).
 */

export interface YieldTxn {
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
}

export interface YieldMonth {
  /** First-of-month UTC epoch ms — the bar's x anchor. */
  monthMs: number;
  label: string;
  year: number;
  /** Paid distributions in this month (real). */
  realizedUsdc: number;
  /** Projected payout low edge (0 for past months). */
  projLo: number;
  /** Projected payout high edge (0 for past months). */
  projHi: number;
  status: "paid" | "projected" | "empty";
}

export interface YieldCumulativePoint {
  monthMs: number;
  /** Cumulative paid through this month (null once past "now"). */
  paid: number | null;
  /** Cumulative projected mid from "now" onward (null before "now"). */
  projectedMid: number | null;
}

export interface YieldHistory {
  months: YieldMonth[];
  cumulative: YieldCumulativePoint[];
  paidToDate: number;
  /** Next projected monthly payout range. */
  nextPayoutLo: number;
  nextPayoutHi: number;
  hasPaid: boolean;
}

function firstOfMonthMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function addMonthsMs(ms: number, n: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}
function sameMonth(aMs: number, bMs: number): boolean {
  return aMs === bMs;
}

export function buildYieldHistory(inputs: {
  transactions: readonly YieldTxn[];
  principalUsdc: number;
  realizedApyLowPct: number;
  realizedApyHighPct: number;
  subscribedAt: Date;
  maturityAt: Date | null;
  now: Date;
  /** Safety cap on axis length. */
  maxMonths?: number;
}): YieldHistory {
  const principal = Math.max(0, inputs.principalUsdc);
  const loMonthly = (principal * Math.max(0, inputs.realizedApyLowPct)) / 1200;
  const hiMonthly = (principal * Math.max(0, inputs.realizedApyHighPct)) / 1200;
  const maxMonths = inputs.maxMonths ?? 14;

  const startMs = firstOfMonthMs(inputs.subscribedAt);
  const nowMs = firstOfMonthMs(inputs.now);
  const endMs = firstOfMonthMs(
    inputs.maturityAt ?? new Date(addMonthsMs(startMs, 11)),
  );

  // Realized distributions folded by month.
  const paidByMonth = new Map<number, number>();
  for (const t of inputs.transactions) {
    if (t.type !== "distribution" || t.amountUsdc <= 0) continue;
    const m = firstOfMonthMs(t.occurredAt);
    paidByMonth.set(m, (paidByMonth.get(m) ?? 0) + t.amountUsdc);
  }

  const months: YieldMonth[] = [];
  let m = startMs;
  let guard = 0;
  while (m <= endMs && guard < maxMonths) {
    const realizedUsdc = paidByMonth.get(m) ?? 0;
    const isFuture = m > nowMs;
    const projLo = isFuture ? loMonthly : 0;
    const projHi = isFuture ? hiMonthly : 0;
    const status: YieldMonth["status"] =
      realizedUsdc > 0 ? "paid" : isFuture ? "projected" : "empty";
    months.push({
      monthMs: m,
      label: new Date(m).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      year: new Date(m).getUTCFullYear(),
      realizedUsdc,
      projLo,
      projHi,
      status,
    });
    m = addMonthsMs(m, 1);
    guard++;
  }

  // Cumulative lines: paid through "now", then projected mid onward.
  const cumulative: YieldCumulativePoint[] = [];
  let cumPaid = 0;
  let cumProj = 0;
  let crossedNow = false;
  for (const month of months) {
    const isFuture = month.monthMs > nowMs;
    if (!isFuture) {
      cumPaid += month.realizedUsdc;
      cumProj = cumPaid; // projection anchors at the paid total
      cumulative.push({
        monthMs: month.monthMs,
        paid: cumPaid,
        projectedMid: sameMonth(month.monthMs, nowMs) ? cumPaid : null,
      });
      if (sameMonth(month.monthMs, nowMs)) crossedNow = true;
    } else {
      cumProj += (month.projLo + month.projHi) / 2;
      cumulative.push({
        monthMs: month.monthMs,
        paid: null,
        projectedMid: cumProj,
      });
    }
  }
  // If "now" fell before the first month, seed the projection anchor.
  if (!crossedNow && cumulative.length > 0 && cumulative[0]!.projectedMid === null) {
    cumulative[0] = { ...cumulative[0]!, projectedMid: 0 };
  }

  const paidToDate = [...paidByMonth.values()].reduce((s, v) => s + v, 0);

  return {
    months,
    cumulative,
    paidToDate,
    nextPayoutLo: loMonthly,
    nextPayoutHi: hiMonthly,
    hasPaid: paidToDate > 0,
  };
}
