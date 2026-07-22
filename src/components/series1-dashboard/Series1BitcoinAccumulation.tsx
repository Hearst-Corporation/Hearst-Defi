// Series1BitcoinAccumulation — the investor's principal outcome.
//
// Wires `BtcAccumulationCurve`, one of the eight preserved reserve-cockpit
// modules that were built, token-only, and left ORPHANED (canon F8 — only
// CapitalFlowRail was ever mounted). The old page rendered a hand-rolled
// `Series1ChartPlaceholder` with raw #a7fb90 hex instead.
//
// The contract reports a cumulative total, not a per-month series, so the
// curve has no series to draw yet. That is stated once, honestly — the module
// renders its own DataUnavailable state rather than a fabricated line.

import { BtcAccumulationCurve } from "@/features/investor-ui/components/reserve-cockpit";
import type { HcSourceStatus } from "@/components/dataviz/his";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
  Series1DashboardInset,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";

export function Series1BitcoinAccumulation({
  /** Provenance of the mining read that would feed the series. */
  source,
  /** Group motive when the underlying read did not resolve. */
  motive,
  className,
}: {
  source: HcSourceStatus;
  motive: string | null;
  className?: string;
}) {
  return (
    <Series1DashboardCard className={className}>
      <Series1DashboardCardHeader
        title="Accumulated Bitcoin"
        caption="Mining production credited to the reserve through the term. Delivered in BTC at maturity."
      />
      <Series1DashboardInset className="p-[var(--ct-space-5)]">
        {/* The module owns its own honest empty state: `data={null}` renders
            DataUnavailable, never a fabricated curve. */}
        <BtcAccumulationCurve data={null} source={source} />
      </Series1DashboardInset>
      {motive ? (
        <div className="border-t border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
          <Series1DataState
            motive={motive}
            detail="a monthly series appears once the ledger indexes per-month credits"
          />
        </div>
      ) : null}
    </Series1DashboardCard>
  );
}
