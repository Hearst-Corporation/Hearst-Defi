import "server-only";

import { getInvestor } from "@/lib/auth/session";
import {
  loadPortfolio,
  loadRiskPulseProps,
  loadDistribCalendarProps,
  loadProofPulseProps,
  loadYieldStackProps,
  loadAllocationDonutProps,
  loadTimeToCashProps,
  resolveProvenance,
  type PortfolioData,
} from "@/lib/data/portfolio";

/**
 * Single source of the portfolio view-model wiring.
 *
 * The dashboard (`/portfolio`) and every "view more" leaf page
 * (`/portfolio/positions`, `/yield`, `/distributions`, `/activity`) need the
 * SAME data derivation. Centralising it here keeps wiring identical across
 * surfaces (no forked logic) and avoids re-deriving per page.
 *
 * No demo / previewZeros / zero-state logic. When a user has no positions,
 * individual widgets show inline honest placeholders ("No position yet", "—").
 */
export async function loadPortfolioView() {
  const [investor, data] = await Promise.all([
    getInvestor(),
    loadPortfolio(),
  ]);

  const hasPositions = data.positions.length > 0;

  const [
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    timeToCashProps,
  ] = await Promise.all([
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
    loadAllocationDonutProps(hasPositions),
    hasPositions ? loadTimeToCashProps() : Promise.resolve(null),
  ]);

  const nextPayoutUsdc =
    timeToCashProps &&
    timeToCashProps.source === "live" &&
    timeToCashProps.projectedUsdc > 0
      ? timeToCashProps.projectedUsdc
      : undefined;

  // APY-range fallback: the header ticker + Capital & Yield read blendedLow/High
  // from the vault snapshot. When no snapshot-with-allocations exists yet, those
  // are 0 and the header shows "—" while the positions table shows the real range
  // (8–15%) — a glaring inconsistency. Fall back to the investor's own position
  // range so every surface agrees. Provenance drops to "estimated" (not "live").
  const blendedYieldStackProps =
    yieldStackProps.blendedLow + yieldStackProps.blendedHigh === 0
      ? applyPositionApyFallback(yieldStackProps, data.positions)
      : yieldStackProps;

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);

  const now = new Date();

  return {
    investor,
    data,
    hasPositions,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps: blendedYieldStackProps,
    allocationDonutProps,
    portfolioProvenance,
    timeToCashProps,
    nextPayoutUsdc,
    now,
  };
}

/**
 * Derive a blended APY range from the investor's ACTIVE positions (min low / max
 * high across positions that carry a range) and graft it onto the yield-stack
 * props when the vault snapshot didn't provide one. Keeps `sources` empty (we
 * don't fabricate a yield-source breakdown) but gives the header + Capital&Yield
 * a real range instead of "—". Returns the input untouched when no position
 * range is available.
 */
function applyPositionApyFallback<
  T extends { blendedLow: number; blendedHigh: number; source: "live" | "stale" },
>(
  props: T,
  positions: PortfolioData["positions"],
): T & { source: "live" | "stale" | "estimated" } {
  const ranges = positions
    .filter((p) => p.status === "active" && p.apyLow !== null && p.apyHigh !== null)
    .map((p) => ({ low: p.apyLow as number, high: p.apyHigh as number }));

  if (ranges.length === 0) return props;

  const low = Math.min(...ranges.map((r) => r.low));
  const high = Math.max(...ranges.map((r) => r.high));

  return { ...props, blendedLow: low, blendedHigh: high, source: "estimated" };
}
