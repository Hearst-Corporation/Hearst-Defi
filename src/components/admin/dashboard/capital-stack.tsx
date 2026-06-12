import { DashboardPanelHeader } from "@/components/ui/system-panel";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import type { DashboardAllocation } from "@/lib/data/dashboard";

import { DashboardCommandCell } from "./command-cell";
import { usdCompact } from "./formatters";

export function CapitalStack({
  live,
  allocations,
}: {
  live: boolean;
  allocations: DashboardAllocation[];
}) {
  return (
    <DashboardCommandCell
      ready={live}
      surface="card"
      emptyMessage="Capital stack appears once the first snapshot books real allocations."
      emptyAriaLabel="Capital stack awaiting first snapshot"
    >
      <DashboardPanelHeader title="Capital stack" provenance="live" tone="primary" />
      <div className="dashboard-assets-stack">
        {allocations.map((item) => (
          <AllocationStackRow key={item.bucket} item={item} />
        ))}
      </div>
    </DashboardCommandCell>
  );
}

function AllocationStackRow({ item }: { item: DashboardAllocation }) {
  const hasValue = item.valueUsdc > 0;
  return (
    <div className="dashboard-assets-stack__row">
      <div>
        <span
          aria-hidden
          className="dashboard-assets-stack__dot"
          style={{ background: allocationStrokeFor(item.bucket) }}
        />
        <span>{allocationLabelFor(item.bucket)}</span>
      </div>
      <div className="dashboard-assets-stack__bar">
        <span
          style={{
            width: `${Math.max(2, Math.min(100, item.pct))}%`,
            background: allocationStrokeFor(item.bucket),
          }}
        />
      </div>
      <strong className="tabular">{item.pct.toFixed(0)}%</strong>
      <small>{hasValue ? usdCompact.format(item.valueUsdc) : "—"}</small>
    </div>
  );
}
