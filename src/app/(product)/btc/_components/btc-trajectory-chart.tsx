// src/app/(product)/btc/_components/btc-trajectory-chart.tsx
//
// Accumulation trajectory fan chart (D8) — simulated p5/p50/p95 bands over
// the 24-month term, resurrected WITHOUT the % return-range headline (the
// range metric is retired from this surface; bands + methodology mention +
// "not guaranteed" disclaimer stay). Reuses HcFanChart/HcChartCard (HIS
// primitives) — no new chart primitive invented here.
//
// Honesty: bands come straight from the trajectory view model (percent of
// principal, indexed at 100); provenance rendered via the unified
// toProvenance mapping (FIXTURE -> simulated). PTAI narration kept
// (non-negotiable #3) — reworded without any % figure.

import { HcChartCard, HcFanChart } from "@/components/dataviz/his";
import { Ptai } from "@/components/catalyst/ptai";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import { toProvenance } from "@/features/investor-ui/format-btc";
import type { BtcTrajectoryViewModel } from "../_data/btc-page-types";

export function BtcTrajectoryChart({
  trajectory,
}: {
  trajectory: ResolvedViewModel<BtcTrajectoryViewModel>;
}) {
  if (trajectory.status === "NOT_CONFIGURED" || trajectory.value === null) {
    return (
      <DataNotConfigured
        label="Accumulation trajectory"
        detail="This reads from PermissionedDynaVault v2.1, which is not deployed yet."
      />
    );
  }

  const { value } = trajectory;
  const monthsRemaining = Math.max(0, value.monthsTotal - value.monthsElapsed);

  const chart = (
    <HcChartCard
      title="Accumulation trajectory"
      subtitle={`Simulated p5 / p50 / p95 accumulated-BTC bands, % of principal · Methodology ${value.methodologyVersion}`}
      actions={<ProvenanceBadge kind={toProvenance(trajectory.status)} variant="compact" />}
      disclaimer={value.disclaimer}
      height={260}
      aria-label="BTC accumulation trajectory, simulated p5/p50/p95 bands over the product term — not guaranteed"
    >
      {value.bands && value.bands.length >= 2 ? (
        <HcFanChart
          bands={value.bands}
          unit="%"
          height={260}
          aria-label="Accumulation trajectory fan chart, months on the horizontal axis, accumulated BTC as percent of principal on the vertical axis"
        />
      ) : (
        <p className="body-sm ct-text-muted">No trajectory bands available.</p>
      )}
    </HcChartCard>
  );

  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      {trajectory.status === "STALE" ? (
        <DataStale label="Accumulation trajectory" freshness={trajectory.freshness}>
          {chart}
        </DataStale>
      ) : (
        chart
      )}

      <Ptai
        projection={`Simulated accumulation bands (p5/p50/p95, Methodology ${value.methodologyVersion}) to maturity — not guaranteed`}
        trigger={`${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"} remaining in the ${value.monthsTotal}-month term`}
        action="Mining settlements continue crediting the B2 reserve monthly; take-profit ladder executes automatically at each trigger"
        impact="Reserve balance and cost basis update at each settlement — reviewable in the Proof Center"
        variant="flat"
      />
    </div>
  );
}
