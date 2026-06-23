/**
 * Blended APY fallback — pure, no I/O.
 *
 * The header ticker + Capital & Yield read `blendedLow/High` from the vault
 * snapshot. When no snapshot-with-allocations has settled (or its cache is cold),
 * those are 0 and the header shows "—" while the positions table shows the real
 * range — a glaring inconsistency. This grafts a range derived from the
 * investor's OWN active positions so every surface agrees. Provenance drops to
 * "estimated" (not "live") because it's a position-level reference, not the
 * vault's modelled blend.
 */

export interface PositionApyLike {
  status: "active" | "matured" | "exited";
  apyLow: number | null;
  apyHigh: number | null;
}

export interface BlendedApyLike {
  blendedLow: number;
  blendedHigh: number;
  source: "live" | "stale";
}

/** Min low / max high across active positions that carry a range, or null. */
export function positionApyRange(
  positions: readonly PositionApyLike[],
): { low: number; high: number } | null {
  const ranges = positions
    .filter((p) => p.status === "active" && p.apyLow !== null && p.apyHigh !== null)
    .map((p) => ({ low: p.apyLow as number, high: p.apyHigh as number }));

  if (ranges.length === 0) return null;

  return {
    low: Math.min(...ranges.map((r) => r.low)),
    high: Math.max(...ranges.map((r) => r.high)),
  };
}

/**
 * Return `props` unchanged when it already carries a blended range; otherwise
 * graft the position-derived range and mark the source `"estimated"`.
 */
export function withPositionApyFallback<T extends BlendedApyLike>(
  props: T,
  positions: readonly PositionApyLike[],
): T & { source: "live" | "stale" | "estimated" } {
  if (props.blendedLow + props.blendedHigh > 0) return props;

  const range = positionApyRange(positions);
  if (!range) return props;

  return { ...props, blendedLow: range.low, blendedHigh: range.high, source: "estimated" };
}
