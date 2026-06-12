import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import type { DashboardAllocation } from "@/lib/data/dashboard";

import { usdCompact } from "./formatters";

function conicGradientFromAllocations(allocations: DashboardAllocation[]): string {
  let cumul = 0;
  const stops = allocations
    .filter((item) => item.pct > 0)
    .map((item) => {
      const start = cumul;
      cumul += item.pct;
      return `${allocationStrokeFor(item.bucket)} ${start}% ${cumul}%`;
    });
  if (stops.length === 0) {
    return "conic-gradient(var(--ct-surface-3) 0% 100%)";
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

/** CSS conic-gradient orbit — no SVG. */
export function AllocationOrbit({
  live,
  allocations,
  capitalUsdc,
  allocationTotal,
}: {
  live: boolean;
  allocations: DashboardAllocation[];
  capitalUsdc: number;
  allocationTotal: number;
}) {
  if (!live) {
    return (
      <Card className="dashboard-command-cell dashboard-command-cell--awaiting">
        <EmptySurface
          variant="inline"
          className="dashboard-orbit-empty"
          message="Allocation map appears after the first vault snapshot."
        />
      </Card>
    );
  }

  const gradient = conicGradientFromAllocations(allocations);

  return (
    <Card className="dashboard-command-cell" aria-label="Vault allocation map">
      <div className="dashboard-orbit">
        <div className="dashboard-orbit__visual">
          <div className="dashboard-orbit__track" aria-hidden />
          <div
            className="dashboard-orbit__ring"
            style={{ "--dashboard-orbit-gradient": gradient } as React.CSSProperties}
            aria-hidden
          />
          <div className="dashboard-orbit__core">
            <span>AUM</span>
            <strong className="tabular">{usdCompact.format(capitalUsdc)}</strong>
            <small>{allocationTotal.toFixed(0)}% mapped</small>
          </div>
        </div>
        <ul className="dashboard-orbit__legend" aria-label="Allocation legend">
          {allocations.map((item) => (
            <li key={item.bucket}>
              <span
                className="dashboard-orbit__legend-dot"
                style={{ background: allocationStrokeFor(item.bucket) }}
                aria-hidden
              />
              <span>{allocationLabelFor(item.bucket)}</span>
              <span className="tabular">{item.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
