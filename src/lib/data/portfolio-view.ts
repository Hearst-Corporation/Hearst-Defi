import "server-only";

import { getInvestor } from "@/lib/auth/session";
import {
  loadPortfolio,
  loadRiskPulseProps,
  loadDistribCalendarProps,
  loadProofPulseProps,
  loadYieldStackProps,
  loadAllocationDonutProps,
  resolveProvenance,
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
  ] = await Promise.all([
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
    loadAllocationDonutProps(hasPositions),
  ]);

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);

  return {
    investor,
    data,
    hasPositions,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    portfolioProvenance,
  };
}
