import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import {
  computeNavBarHeights,
  navBarChartAriaLabel,
} from "@/lib/admin/nav-bar-chart";
import { cn } from "@/lib/cn";
import type { NavPoint } from "@/lib/data/dashboard";

import { usdCompact, usdFull } from "./formatters";

/** NAV slot — empty = chart placeholder (DS §9); live = card + bars. */
export function NavSlot({
  navLive,
  navPoints,
  lastNav,
  navDelta,
  navProvenance,
}: {
  navLive: boolean;
  navPoints: NavPoint[];
  lastNav: number | null;
  navDelta: number | null;
  navProvenance: Provenance;
}) {
  if (!navLive) {
    return (
      <Card className="dashboard-command-slot dashboard-command-slot--nav dashboard-command-cell--awaiting">
        <EmptySurface
          variant="inline"
          className="dashboard-command-nav-empty"
          message="NAV trend appears after seven booked snapshots across at least two days."
        />
      </Card>
    );
  }

  return (
    <Card className="dashboard-command-slot dashboard-command-slot--nav">
      <div className="dashboard-command-performance">
        <header className="dashboard-card-header dashboard-command-performance__header">
          <div className="min-w-0">
            <h3 className="h3 ct-text-body m-0">NAV · 30d</h3>
            <p className="stat-value tabular" style={{ marginTop: "var(--ct-space-1)" }}>
              {lastNav !== null ? usdCompact.format(lastNav) : "—"}
            </p>
          </div>
          <ProvenanceBadge kind={navProvenance} variant="strip" />
        </header>

        <NavBarChart points={navPoints} />

        {navDelta !== null ? (
          <div className="dashboard-command-performance__footer">
            <span
              className={cn(
                "body-xs tabular font-semibold",
                navDelta >= 0 ? "ct-status-success" : "ct-status-danger",
              )}
            >
              {navDelta >= 0 ? "+" : ""}
              {navDelta.toFixed(1)}% NAV · 30d
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function NavBarChart({ points }: { points: NavPoint[] }) {
  const slices = computeNavBarHeights(points);

  return (
    <div
      className="dashboard-nav-bars"
      style={{ "--dashboard-nav-bar-count": String(points.length) } as React.CSSProperties}
      role="list"
      aria-label={navBarChartAriaLabel(points)}
    >
      {slices.map((slice) => {
        const label = `${slice.date}: ${usdFull.format(slice.aum_usdc)}`;
        return (
          <div key={slice.date} className="dashboard-nav-bars__cell" role="listitem">
            <div
              className="dashboard-nav-bars__bar"
              style={{ height: `${slice.heightPct}%` }}
              tabIndex={0}
              aria-label={label}
              title={label}
            />
          </div>
        );
      })}
    </div>
  );
}
