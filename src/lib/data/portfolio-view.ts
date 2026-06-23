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
} from "@/lib/data/portfolio";
import { withPositionApyFallback } from "@/lib/portfolio/blended-apy";

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

  // APY-range fallback: header ticker + Capital & Yield read blendedLow/High from
  // the vault snapshot. When that's cold/absent (0/0), fall back to the investor's
  // own active-position range so no surface shows "—" while the positions table
  // shows a real range. See @/lib/portfolio/blended-apy.
  const blendedYieldStackProps = withPositionApyFallback(yieldStackProps, data.positions);

  return {
    investor,
    data,
    hasPositions,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps: blendedYieldStackProps,
    allocationDonutProps,
    timeToCashProps,
    nextPayoutUsdc,
  };
}
