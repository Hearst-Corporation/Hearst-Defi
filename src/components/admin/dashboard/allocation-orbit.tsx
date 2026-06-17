import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { Provenance } from "@/components/ui/provenance-badge";
import { allocationLabelFor, allocationStrokeFor } from "@/lib/allocation-colors";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
import type { DashboardAllocation } from "@/lib/data/dashboard";

/**
 * Premium SVG Donut Chart for Capital Allocation.
 * Uses a 100-unit circumference circle (r=15.9155) for easy percentage mapping.
 */
function SvgDonut({ allocations }: { allocations: DashboardAllocation[] }) {
  const radius = 15.915494309189533;
  const circumference = 100;

  // Precompute cumulative offsets so no `let` is mutated during render.
  // Each segment starts where the previous one ended (clockwise = subtract pct).
  const visibleItems = allocations.filter((item) => item.pct > 0);
  const segments = visibleItems.reduce<
    { item: DashboardAllocation; strokeDashoffset: number }[]
  >((acc, item) => {
    const prevOffset = acc.length === 0 ? 100 : (acc[acc.length - 1]!.strokeDashoffset - acc[acc.length - 1]!.item.pct);
    return [...acc, { item, strokeDashoffset: prevOffset }];
  }, []);

  return (
    <svg viewBox="0 0 42 42" className="dashboard-orbit__svg" aria-hidden="true">
      {/* Background track */}
      <circle
        className="dashboard-orbit__track"
        cx="21"
        cy="21"
        r={radius}
        fill="none"
        stroke="color-mix(in srgb, var(--ct-accent) 15%, transparent)"
      />

      {/* Segments */}
      {segments.map(({ item, strokeDashoffset }) => {
        const strokeDasharray = `${item.pct} ${circumference - item.pct}`;

        return (
          <circle
            key={item.bucket}
            className="dashboard-orbit__segment"
            cx="21"
            cy="21"
            r={radius}
            fill="none"
            stroke={allocationStrokeFor(item.bucket)}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transformOrigin: "center" }}
          />
        );
      })}
    </svg>
  );
}

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
  const isEmpty = allocationTotal <= 0;

  return (
    <div
      className="dashboard-command-cell dashboard-orbit-card"
      aria-label="Vault allocation map"
    >
      <DashboardPanelHeader
        title="Capital allocation"
        eyebrow="Balance sheet"
        tone="quiet"
        provenance={!isEmpty ? provenance : undefined}
      />
      <div className="dashboard-orbit">
        <div className="dashboard-orbit__visual">
          <SvgDonut allocations={allocations} />
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
