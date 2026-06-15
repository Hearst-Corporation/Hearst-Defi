import { Card } from "@/components/ui/card";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
import {
  DASHBOARD_ZERO_ALLOCATIONS,
} from "@/lib/admin/dashboard-vault-signals";
import type { DashboardAllocation } from "@/lib/data/dashboard";

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
  const displayAllocations = live ? allocations : DASHBOARD_ZERO_ALLOCATIONS;
  const gradient = conicGradientFromAllocations(displayAllocations);
  const mappedPct = live ? allocationTotal : 0;

  return (
    <Card
      hoverOverlay={false}
      className={`dashboard-command-cell dashboard-orbit-card${live ? "" : " dashboard-orbit-card--awaiting"}`}
      aria-label={live ? "Vault allocation map" : "Vault allocation map awaiting first snapshot"}
    >
      <div className={`dashboard-orbit ${live ? "" : "dashboard-orbit--target"}`}>
        <div className="dashboard-orbit__visual">
          <div className="dashboard-orbit__track" aria-hidden />
          <div
            className="dashboard-orbit__ring"
            style={{ "--dashboard-orbit-gradient": gradient } as React.CSSProperties}
            aria-hidden
          />
          <div className="dashboard-orbit__core">
            <span>AUM</span>
            <strong className="tabular">{dashboardUsdCompact.format(live ? capitalUsdc : 0)}</strong>
            <small>{mappedPct.toFixed(0)}% mapped</small>
          </div>
        </div>
        <ul className="dashboard-orbit__legend" aria-label="Allocation legend">
          {displayAllocations.map((item) => (
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
        {!live ? (
          <p className="dashboard-instrument-note">Awaiting first live snapshot.</p>
        ) : null}
      </div>
    </Card>
  );
}
