import type { ValueSeriesTx } from "../value-series";
import { VB_W, VB_H, PAD_X, PAD_Y_TOP, DRAW_W, DRAW_H } from "./svgConstants";

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  date: Date;
  isDistribution?: boolean;
}

/**
 * Reconstruct a 12-month value series from transactions and current total.
 * Returns a series of points projected into the SVG viewBox.
 */
export function projectValueSeries(
  transactions: ValueSeriesTx[],
  totalValueUsdc: number,
  now: Date = new Date()
): ChartPoint[] {
  // 1. Define time range: 12 months ago to now
  const startTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const endTime = now;
  const totalDuration = endTime.getTime() - startTime.getTime();

  // 2. Sort transactions and filter within range
  const sortedTxs = [...transactions]
    .filter(tx => tx.occurredAt >= startTime && tx.occurredAt <= endTime)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  // 3. Work backwards from current value to find historical values.
  // Each event emits two points at the SAME instant: the value just BEFORE it and
  // the value just AFTER it. `phase` orders them in forward time (before = 0 then
  // after = 1) so the step renders in the correct direction — a deposit steps UP,
  // a withdrawal/distribution steps DOWN — never a spurious up-then-down zigzag.
  const points: { date: Date; value: number; isDistribution?: boolean; phase: number }[] = [];

  // Current state (held from the most recent event until now).
  let currentValue = totalValueUsdc;
  points.push({ date: endTime, value: currentValue, phase: 0 });

  // Iterate backwards through transactions
  for (let i = sortedTxs.length - 1; i >= 0; i--) {
    const tx = sortedTxs[i]!;

    // Value AFTER the transaction (holds from this event forward) — later phase.
    points.push({ date: tx.occurredAt, value: currentValue, phase: 1 });

    // Adjust value based on transaction type (working backwards)
    if (tx.type === "deposit") {
      currentValue -= tx.amountUsdc;
    } else if (tx.type === "withdraw") {
      currentValue += tx.amountUsdc;
    } else if (tx.type === "distribution" || tx.type === "claim") {
      // Distributions/claims are paid out of accrued yield.
      // Working backwards, we add them back to see the value before payout.
      currentValue += tx.amountUsdc;
    }

    // Value BEFORE the transaction — earlier phase at this same instant.
    points.push({
      date: tx.occurredAt,
      value: currentValue,
      isDistribution: tx.type === "distribution",
      phase: 0,
    });
  }

  // Add start point
  points.push({ date: startTime, value: currentValue, phase: 0 });

  // 4. Sort points forwards (by date, then phase) and project to SVG. Sorting by
  // phase at an equal timestamp guarantees the before-state precedes the after-state,
  // i.e. a clean vertical step in the correct direction (deterministic across engines).
  const sortedPoints = points
    .sort((a, b) => (a.date.getTime() - b.date.getTime()) || (a.phase - b.phase));

  const minVal = Math.min(...sortedPoints.map(p => p.value));
  const maxVal = Math.max(...sortedPoints.map(p => p.value), 1); // Avoid div by 0
  const valSpan = maxVal - minVal || 1;
  // P2: flat series (all values equal) → centre the line vertically instead of
  // collapsing it to the chart floor (valFrac would be 0 for every point otherwise).
  const isFlat = maxVal === minVal;

  return sortedPoints.map(p => {
    const timeFrac = (p.date.getTime() - startTime.getTime()) / totalDuration;
    const valFrac = isFlat ? 0.5 : (p.value - minVal) / valSpan;

    return {
      x: PAD_X + timeFrac * DRAW_W,
      y: PAD_Y_TOP + DRAW_H - valFrac * DRAW_H,
      value: p.value,
      date: p.date,
      isDistribution: p.isDistribution
    };
  });
}

/**
 * Generate an SVG path string for the area under the points.
 */
export function generateAreaPath(points: ChartPoint[]): string {
  if (points.length < 2) return "";
  
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const baseline = VB_H;

  return `${line} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`;
}

/**
 * Generate an SVG path string for the line connecting the points.
 */
export function generateLinePath(points: ChartPoint[]): string {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
