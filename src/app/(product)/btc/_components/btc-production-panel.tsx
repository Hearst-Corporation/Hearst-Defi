// src/app/(product)/btc/_components/btc-production-panel.tsx
//
// Monthly BTC production (mining settlements feeding the reserve) + running
// cumulative total. HcBarChart primitive, no new chart invented.

import { HcBarChart, HcChartCard } from "@/components/dataviz/his";
import { Metric } from "@/components/catalyst/metric";
import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BtcProductionViewModel } from "../_data/btc-page-types";
import { formatBtcAmount, formatPeriodShort, toProvenance } from "../_data/format-btc";

export function BtcProductionPanel({
  production,
}: {
  production: ResolvedViewModel<BtcProductionViewModel>;
}) {
  if (production.status === "NOT_CONFIGURED" || production.value === null) {
    return (
      <DataNotConfigured
        label="Mining production"
        detail="This reads from the keeper-driven monthly engine, which is not deployed yet."
      />
    );
  }

  const { value } = production;
  const bars = value.monthly.map((point) => ({
    label: formatPeriodShort(point.period),
    value: Number(point.satsEarned) / 100_000_000,
    tooltip: `${(Number(point.satsEarned) / 100_000_000).toFixed(4)} BTC`,
  }));

  const chart = (
    <HcChartCard
      title="Monthly BTC production"
      subtitle="Mining settlements credited to the B2 reserve"
      source={production.status === "STALE" ? "stale" : "estimated"}
      height={240}
      aria-label="Monthly BTC production from mining settlements"
    >
      <HcBarChart
        bars={bars}
        highlightLast
        valueFormat={(v) => `${v.toFixed(2)}`}
        emptyMessage="No settlements recorded yet"
        aria-label="Monthly BTC production bar chart"
      />
    </HcChartCard>
  );

  return (
    <div className="flex flex-col gap-[var(--ct-space-4)]">
      {production.status === "STALE" ? (
        <DataStale label="Mining production" freshness={production.freshness}>
          {chart}
        </DataStale>
      ) : (
        chart
      )}

      <Metric
        label="Cumulative BTC accumulated"
        value={formatBtcAmount(value.cumulativeBtcEarned)}
        sublabel="Since inception"
        provenance={toProvenance(production.status)}
        tooltip="Running total of BTC credited to the reserve from mining settlements since the note's inception."
      />
    </div>
  );
}
