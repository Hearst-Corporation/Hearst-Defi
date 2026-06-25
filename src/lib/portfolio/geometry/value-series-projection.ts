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

  // 3. Work backwards from current value to find historical values
  // We want a point for each transaction + start/end points.
  const points: { date: Date; value: number; isDistribution?: boolean }[] = [];
  
  // Current state
  let currentValue = totalValueUsdc;
  points.push({ date: endTime, value: currentValue });

  // Iterate backwards through transactions
  for (let i = sortedTxs.length - 1; i >= 0; i--) {
    const tx = sortedTxs[i]!;
    
    // Add point at the transaction time (with the value AFTER the transaction)
    points.push({ 
      date: tx.occurredAt, 
      value: currentValue
    });

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

    // Add point at the transaction time (with the value BEFORE the transaction)
    points.push({ 
      date: tx.occurredAt, 
      value: currentValue,
      isDistribution: tx.type === "distribution" 
    });
  }

  // Add start point
  points.push({ date: startTime, value: currentValue });

  // 4. Sort points forwards and project to SVG.
  // Tie-breaker on insertion index: two points can share the same date (distribution
  // emits a value-AFTER point then a value-BEFORE point at occurredAt). Preserving
  // insertion order keeps the visual segment direction deterministic across JS engines.
  const sortedPoints = points
    .map((p, _i) => ({ ...p, _i }))
    .sort((a, b) => (a.date.getTime() - b.date.getTime()) || (a._i - b._i));

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
