// src/app/(product)/btc/_components/btc-trajectory-chart.tsx
//
// Trajectory fan chart (p5/p50/p95 accumulation projection) + PTAI narration
// of what happens next. Reuses HcFanChart/HcChartCard (HIS primitives) —
// no new chart primitive invented here.

import { HcChartCard, HcFanChart } from "@/components/dataviz/his";
import { Ptai } from "@/components/catalyst/ptai";
import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import { formatApyRange } from "@/lib/format/apy";
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
  const rangeLabel = formatApyRange(
    { low: value.projectedRangeLowPct, high: value.projectedRangeHighPct },
    1,
    { spaced: true },
  );

  const chart = (
    <HcChartCard
      title="Accumulation projection"
      subtitle={`p5 / p50 / p95 over the ${value.monthsTotal}-month term`}
      metric={rangeLabel}
      metricCompact
      source={trajectory.status === "STALE" ? "stale" : "estimated"}
      disclaimer={value.disclaimer}
      height={260}
      aria-label={`BTC accumulation projection, estimated range ${rangeLabel} at maturity`}
    >
      {value.bands && value.bands.length >= 2 ? (
        <HcFanChart
          bands={value.bands}
          unit="%"
          height={260}
          aria-label="Accumulation projection fan chart, months on the horizontal axis, percent of principal on the vertical axis"
        />
      ) : (
        <p className="body-sm ct-text-muted">No projection bands available.</p>
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
        projection={`Estimated ${rangeLabel} accumulated BTC (of principal) at maturity — not guaranteed`}
        trigger={`${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"} remaining in the 24-month term`}
        action="Mining settlements continue crediting the B2 reserve monthly; take-profit ladder executes automatically at each trigger"
        impact="Reserve balance and cost basis update at each settlement — reviewable in the event timeline and Proof Center"
        variant="flat"
      />
    </div>
  );
}
