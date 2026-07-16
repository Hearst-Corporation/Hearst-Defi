// src/app/(product)/btc/_components/btc-performance-panel.tsx
//
// Performance block — NAV/share, total return since inception, take-profit
// ladder progress. Consumes A5's PerformanceViewModel directly (shared type).

import { Metric } from "@/components/catalyst/metric";
import { Progress } from "@/components/catalyst/progress";
import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { PerformanceViewModel } from "@/features/investor-ui/types/btc";
import { formatBps, toProvenance } from "../_data/format-btc";

export function BtcPerformancePanel({
  performance,
}: {
  performance: ResolvedViewModel<PerformanceViewModel>;
}) {
  if (performance.status === "NOT_CONFIGURED" || performance.value === null) {
    return (
      <DataNotConfigured
        label="Performance"
        detail="This reads from PermissionedDynaVault v2.1, which is not deployed yet."
      />
    );
  }

  const { value } = performance;
  const provenance = toProvenance(performance.status);

  const body = (
    <div className="grid grid-cols-1 gap-[var(--ct-space-4)] md:grid-cols-2">
      <Metric
        label="NAV per share"
        value={value.navPerShare ?? "—"}
        provenance={provenance}
        tooltip="Net asset value per share, BTC-denominated performance since inception."
      />
      <Metric
        label="Total return"
        value={value.totalReturnBps != null ? formatBps(value.totalReturnBps) : "—"}
        sublabel="Since inception"
        provenance={provenance}
        tooltip="Total BTC-denominated return since inception, expressed as a percentage of principal."
      />
      <div className="flex flex-col gap-[var(--ct-space-2)] md:col-span-2">
        <Metric
          variant="nested"
          label="Take-profit ladder progress"
          value={value.takeProfitProgressBps != null ? formatBps(value.takeProfitProgressBps) : "—"}
          tooltip="Progress toward the next take-profit tier trigger."
        />
        <Progress
          value={value.takeProfitProgressBps ?? 0}
          max={10000}
          label="Take-profit ladder progress"
          fillClassName="bg-[var(--ct-accent)]"
        />
      </div>
    </div>
  );

  return performance.status === "STALE" ? (
    <DataStale label="Performance" freshness={performance.freshness}>
      {body}
    </DataStale>
  ) : (
    body
  );
}
