import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { Provenance } from "@/components/ui/provenance-badge";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
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
  allocations,
  capitalUsdc,
  allocationTotal,
  provenance,
}: {
  allocations: DashboardAllocation[];
  capitalUsdc: number;
  allocationTotal: number;
  provenance: Provenance;
}) {
  const gradient = conicGradientFromAllocations(allocations);
  const isEmpty = allocationTotal <= 0;
  const ringStyle = isEmpty
    ? undefined
    : ({
        "--dashboard-orbit-gradient": gradient,
      } as React.CSSProperties);

  return (
    <div
      className="dashboard-command-cell dashboard-orbit-card"
      aria-label="Vault allocation map"
    >
      <DashboardPanelHeader title="Allocation" tone="quiet" provenance={provenance} />
      <div className="dashboard-orbit">
        <div className="dashboard-orbit__visual">
          <div className="dashboard-orbit__track" aria-hidden />
          <div
            className={isEmpty ? "dashboard-orbit__ring dashboard-orbit__ring--idle" : "dashboard-orbit__ring"}
            style={ringStyle}
            aria-hidden
          />
          <div className="dashboard-orbit__core">
            <span>AUM</span>
            <strong className="tabular">
              {dashboardUsdCompact.format(capitalUsdc)}
            </strong>
            <small>{allocationTotal.toFixed(0)}% mapped</small>
          </div>
        </div>
        <ul className="dashboard-orbit__legend" aria-label="Allocation legend">
          {allocations.map((item) => (
            <li key={item.bucket}>
              <span
                className="dashboard-orbit__legend-dot"
                style={{ color: allocationStrokeFor(item.bucket) }}
                aria-hidden
              />
              <span>{allocationLabelFor(item.bucket)}</span>
              <span className="tabular">{item.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
