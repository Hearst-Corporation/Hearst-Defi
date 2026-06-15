import { Card } from "@/components/ui/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { dashboardUsdCompact, dashboardUsdFull } from "@/lib/admin/dashboard-formatters";
import {
  computeNavBarHeights,
  MIN_NAV_CHART_POINTS,
  navBarChartAriaLabel,
} from "@/lib/admin/nav-bar-chart";
import { cn } from "@/lib/cn";
import type { NavPoint } from "@/lib/data/dashboard";

/** Placeholder column count — full ghost grid, not the 2-point minimum. */
const NAV_PLACEHOLDER_COLUMNS = 30;

/** NAV slot — awaiting = muted chart shell; live = card + bars. */
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
  const displayPoints = navLive ? navPoints : buildZeroNavPoints();

  if (!navLive) {
    return (
      <Card
        hoverOverlay={false}
        className="dashboard-command-slot dashboard-command-slot--nav dashboard-command-cell--awaiting"
      >
        <div className="dashboard-command-performance">
          <header className="dashboard-card-header dashboard-command-performance__header">
            <div className="min-w-0">
              <h3 className="h3 ct-text-body m-0">NAV · 30d</h3>
              <p className="stat-value tabular" style={{ marginTop: "var(--ct-space-1)" }}>
                —
              </p>
            </div>
            <ProvenanceBadge kind={navProvenance} variant="strip" />
          </header>
          <NavBarChart points={displayPoints} muted />
          <p className="dashboard-instrument-note">
            Awaiting {MIN_NAV_CHART_POINTS}+ booked snapshots.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card hoverOverlay={false} className="dashboard-command-slot dashboard-command-slot--nav">
      <div className="dashboard-command-performance">
        <header className="dashboard-card-header dashboard-command-performance__header">
          <div className="min-w-0">
            <h3 className="h3 ct-text-body m-0">NAV · 30d</h3>
            <p className="stat-value tabular" style={{ marginTop: "var(--ct-space-1)" }}>
              {lastNav !== null ? dashboardUsdCompact.format(lastNav) : "—"}
            </p>
          </div>
          <ProvenanceBadge kind={navProvenance} variant="strip" />
        </header>

        <NavBarChart points={displayPoints} />

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

function buildZeroNavPoints(): NavPoint[] {
  return Array.from({ length: NAV_PLACEHOLDER_COLUMNS }, (_, index) => ({
    date: `T-${NAV_PLACEHOLDER_COLUMNS - index}`,
    aum_usdc: 0,
  }));
}

function NavBarChart({ points, muted = false }: { points: NavPoint[]; muted?: boolean }) {
  const slices = computeNavBarHeights(points);

  return (
    <div
      className={cn("dashboard-nav-bars", muted && "dashboard-nav-bars--muted")}
      style={{ "--dashboard-nav-bar-count": String(points.length) } as React.CSSProperties}
      role="list"
      aria-label={muted ? "NAV trend — awaiting data" : navBarChartAriaLabel(points)}
    >
      {slices.map((slice) => {
        const label = `${slice.date}: ${dashboardUsdFull.format(slice.aum_usdc)}`;
        return (
          <div key={slice.date} className="dashboard-nav-bars__cell" role="listitem">
            <div
              className="dashboard-nav-bars__bar"
              style={muted ? undefined : { height: `${slice.heightPct}%` }}
              tabIndex={muted ? -1 : 0}
              aria-label={muted ? undefined : label}
              title={muted ? undefined : label}
            />
          </div>
        );
      })}
    </div>
  );
}
