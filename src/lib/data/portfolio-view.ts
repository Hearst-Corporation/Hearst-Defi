import "server-only";

import { getInvestor } from "@/lib/auth/session";
import {
  loadPortfolio,
  loadLockMeterProps,
  loadTimeToCashProps,
  loadRiskPulseProps,
  loadDistribCalendarProps,
  loadProofPulseProps,
  loadYieldStackProps,
  loadAllocationDonutProps,
  resolveProvenance,
} from "@/lib/data/portfolio";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoPortfolio } from "@/lib/demo/builders";
import { isLayoutPreview } from "@/lib/portfolio/layout-preview";
import {
  resolvePortfolioViewState,
  resolveWidgetView,
  type WidgetView,
} from "@/lib/portfolio/view-state";
import {
  resolveLiquidityWidgetView,
  resolvePayoutWidgetView,
} from "@/lib/portfolio/hero-rail-state";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";

/**
 * Single source of the portfolio view-model wiring.
 *
 * The dashboard (`/portfolio`) and every "view more" leaf page
 * (`/portfolio/positions`, `/yield`, `/distributions`, `/activity`) need the
 * SAME demo + previewZeros + provenance + widget-props derivation. Centralising
 * it here keeps the honesty/state behaviour identical across surfaces (no
 * forked logic) and avoids re-deriving the wiring per page.
 *
 * Honesty invariants preserved verbatim from the original page.tsx:
 *  - `previewZeros = !hasPositions` (real empty investor), NEVER forced for the
 *    demo identity (whose buildDemoPortfolio() returns a populated $500k position).
 *  - the demo honesty signal is the DemoDataBanner, not previewZeros.
 *  - every zero* helper resolves provenance to a neutral "Stale" badge — never a
 *    fabricated Live/Verified.
 */
export async function loadPortfolioView() {
  const [investor, liveData] = await Promise.all([
    getInvestor(),
    loadPortfolio(),
  ]);

  // Demo provider (guard-gated → never production): the recognized demo
  // identity sees the synthetic demo portfolio instead of the live loader
  // result. Non-demo path is byte-identical (liveData == data).
  const demo = isDemoInvestor(investor);
  const data = demo ? buildDemoPortfolio() : liveData;

  const hasPositions = data.positions.length > 0;
  // previewZeros is purely a layout-preview flag for the EMPTY (zero-position)
  // real investor — it must NOT be forced on for the demo identity (D5).
  const previewZeros = isLayoutPreview(hasPositions);
  const previewAsOf = new Date();

  const [
    lockMeterProps,
    timeToCashProps,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    showDemoBanner,
  ] = await Promise.all([
    loadLockMeterProps(),
    loadTimeToCashProps(),
    loadRiskPulseProps(),
    loadDistribCalendarProps(),
    loadProofPulseProps(),
    loadYieldStackProps(hasPositions),
    loadAllocationDonutProps(hasPositions),
    investor?.id != null
      ? investorHasDemoPosition(investor.id)
      : Promise.resolve(false),
  ]);

  const actionFlags = {
    kycStatus: investor?.kycStatus ?? "pending",
    accreditationAttested: investor?.accreditationAttestedAt != null,
    hasWallet: investor?.walletAddress != null,
    positionCount: data.positions.length,
  };

  const portfolioProvenance = resolveProvenance(data.source, data.updatedAt);
  const sectionVariant: "preview" | "active" = previewZeros
    ? "preview"
    : "active";

  // ── Single source of truth for preview/live (Architecture A) ───────────────
  // Page-level discriminant + hero widgets' {mode, provenance} resolved ONCE here.
  // Hero rails (payout, liquidity) no longer re-derive showZeroShell in components.
  const state = resolvePortfolioViewState(previewZeros);
  const heroWidgets: {
    value: WidgetView;
    metrics: WidgetView;
    payout: WidgetView;
    liquidity: WidgetView;
  } = {
    value: resolveWidgetView({
      previewZeros,
      hasData: data.totalValueUsdc > 0 || data.positions.length > 0,
      provenance: resolveProvenance(data.source, data.updatedAt, "estimated"),
    }),
    metrics: resolveWidgetView({
      previewZeros,
      hasData: hasPositions,
      provenance: portfolioProvenance,
    }),
    payout: resolvePayoutWidgetView({
      previewZeros,
      source: timeToCashProps.source,
      updatedAt: timeToCashProps.updatedAt,
      projectedUsdc: timeToCashProps.projectedUsdc,
      aprLow: timeToCashProps.aprLow,
      aprHigh: timeToCashProps.aprHigh,
    }),
    liquidity: resolveLiquidityWidgetView({
      previewZeros,
      source: lockMeterProps.source,
      softLockupDays: lockMeterProps.softLockupDays,
    }),
  };

  return {
    investor,
    demo,
    data,
    hasPositions,
    previewZeros,
    previewAsOf,
    state,
    heroWidgets,
    lockMeterProps,
    timeToCashProps,
    riskPulseProps,
    distribCalendarProps,
    proofPulseProps,
    yieldStackProps,
    allocationDonutProps,
    showDemoBanner,
    actionFlags,
    portfolioProvenance,
    sectionVariant,
  };
}
