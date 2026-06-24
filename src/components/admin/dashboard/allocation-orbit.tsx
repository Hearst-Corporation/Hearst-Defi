import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { Provenance } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
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
        const label = `${allocationLabelFor(item.bucket)}: ${item.pct.toFixed(1)}%`;

        return (
          <Tooltip key={item.bucket} content={label}>
            <circle
              className="dashboard-orbit__segment dashboard-orbit__segment--interactive"
              cx="21"
              cy="21"
              r={radius}
              fill="none"
              stroke={allocationStrokeFor(item.bucket)}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transformOrigin: "center", cursor: 'help' }}
            />
          </Tooltip>
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
            <span className="cockpit-label-xs opacity-50">AUM Total</span>
            <strong className="cockpit-value-md text-(length:--ct-text-xl-fixed)! leading-none mt-1">
              {dashboardUsdCompact.format(capitalUsdc)}
            </strong>
            <div className="dashboard-orbit__core-meta mt-1">
              <span className="cockpit-value-xs text-ct-accent font-bold">{allocationTotal.toFixed(0)}%</span>
              <span className="cockpit-label-xs opacity-40 ml-1">Mapped</span>
            </div>
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
              <span className="cockpit-label-sm truncate opacity-80">{allocationLabelFor(item.bucket)}</span>
              <span className="cockpit-value-sm">{item.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
