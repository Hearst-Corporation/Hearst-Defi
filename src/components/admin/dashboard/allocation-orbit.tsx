import type { Provenance } from "@/components/ui/provenance-badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { allocationLabelFor } from "@/lib/allocation-colors";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";
import type { DashboardAllocation } from "@/lib/data/dashboard";

/**
 * Capital allocation orbit — Portfolio bento canon.
 *
 * Single accent (#A7FB90) donut: each segment is the accent at a decreasing
 * opacity so the split reads as one palette, never a rainbow. Track is the
 * canon graphite (#15191C). Geometry is unchanged — a 100-unit circumference
 * circle (r=15.9155) for direct percentage → strokeDasharray mapping.
 */

const ACCENT = "#A7FB90";
const ORBIT_TRACK = "#15191C";

/** Accent opacity ramp — index 0 = full accent, then progressively dimmer. */
const SEGMENT_OPACITY = [1, 0.5, 0.25, 0.12] as const;

function segmentStroke(index: number): string {
  const opacity = SEGMENT_OPACITY[index] ?? 0.08;
  return opacity >= 1
    ? ACCENT
    : `rgba(167, 251, 144, ${opacity})`;
}

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
        stroke={ORBIT_TRACK}
      />

      {/* Segments */}
      {segments.map(({ item, strokeDashoffset }, index) => {
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
              stroke={segmentStroke(index)}
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
      <div className="flex items-end justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] leading-none">
            Balance sheet
          </span>
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
            Capital allocation
          </h3>
        </div>
        {!isEmpty ? <ProvenanceBadge kind={provenance} variant="strip" /> : null}
      </div>
      <div className="dashboard-orbit">
        <div className="dashboard-orbit__visual">
          <SvgDonut allocations={allocations} />
          <div className="dashboard-orbit__core">
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">AUM Total</span>
            <strong className="text-[18px] font-medium leading-none tracking-tight tabular-nums text-white mt-1">
              {dashboardUsdCompact.format(capitalUsdc)}
            </strong>
            <div className="dashboard-orbit__core-meta mt-1">
              <span className="text-[13px] font-semibold tabular-nums text-[#A7FB90]">{allocationTotal.toFixed(0)}%</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 ml-1">Mapped</span>
            </div>
          </div>
        </div>
        <ul className="dashboard-orbit__legend" aria-label="Allocation legend">
          {allocations.map((item, index) => (
            <li key={item.bucket}>
              <span
                className="dashboard-orbit__legend-dot"
                style={{ background: segmentStroke(index) }}
                aria-hidden
              />
              <span className="text-[13px] text-zinc-400 truncate">{allocationLabelFor(item.bucket)}</span>
              <span className="text-[13px] font-medium text-white tabular-nums">{item.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
