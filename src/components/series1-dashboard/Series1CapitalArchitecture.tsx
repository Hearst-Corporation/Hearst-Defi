// Series1CapitalArchitecture — how subscribed capital is governed.
//
// Wires two preserved reserve-cockpit modules that the old dashboard never
// mounted (canon F8): `CapitalFlowRail` (USDC → B1/B2/B3 → ledger → delivery)
// and `PocketAllocationVisual` (the three-pocket ring). It replaces the
// hand-rolled allocation bars (raw #a7fb90 fill) and the bespoke
// Series1Timeline.
//
// Honesty: when the live `strategies()` read is unavailable, the POLICY target
// (40/27/33, VAULT_SPEC_V2.1 §6) is a spec constant and may be shown — but
// only ever LABELLED as the configured target, never as a measurement.

import {
  CapitalFlowRail,
  PocketAllocationVisual,
  type CapitalFlowPocket,
  type PocketAllocation,
} from "@/features/investor-ui/components/reserve-cockpit";
import type { HcSourceStatus } from "@/components/dataviz/his";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
  Series1DashboardInset,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";

export function Series1CapitalArchitecture({
  pockets,
  flowPockets,
  depositAmount,
  /** `live` when the allocation is a chain read; `configured` when it is the policy target. */
  source,
  /** Non-null when the allocation shown is the policy target, not a measurement. */
  policyNotice,
  className,
}: {
  pockets: readonly PocketAllocation[];
  flowPockets: readonly CapitalFlowPocket[];
  depositAmount?: string;
  source: HcSourceStatus;
  policyNotice: string | null;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] xl:grid-cols-[1.15fr_1fr]"
      }
    >
      <Series1DashboardCard>
        <Series1DashboardCardHeader
          title="Capital flow"
          caption="Subscription routes to the policy split on deposit; mining production credits the reserve; the accumulated reserve is delivered in BTC at maturity."
        />
        <Series1DashboardInset className="p-[var(--ct-space-5)]">
          <CapitalFlowRail
            data={{
              depositLabel: "USDC",
              depositAmount,
              pockets: flowPockets,
              ledgerLabel: "BTC Reserve Ledger",
              deliveryLabel: "Delivery at maturity",
            }}
            source={source}
          />
        </Series1DashboardInset>
      </Series1DashboardCard>

      <Series1DashboardCard>
        <Series1DashboardCardHeader
          title="Pocket allocation"
          caption="B1 Mining Power · B2 BTC Reserve · B3 Operating Reserve"
        />
        <Series1DashboardInset className="flex flex-1 items-center justify-center p-[var(--ct-space-5)]">
          <PocketAllocationVisual
            pockets={pockets}
            source={source}
            centerLabel="3 pockets"
          />
        </Series1DashboardInset>
        {policyNotice ? (
          <div className="border-t border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
            <Series1DataState
              motive="Configured policy split"
              detail={policyNotice}
            />
          </div>
        ) : null}
      </Series1DashboardCard>
    </div>
  );
}
