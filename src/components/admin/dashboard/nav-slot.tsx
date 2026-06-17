import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { type Provenance } from "@/components/ui/provenance-badge";
import { dashboardUsdCompact, dashboardUsdFull } from "@/lib/admin/dashboard-formatters";
import {
  computeNavBarHeights,
  MIN_NAV_CHART_POINTS,
  navBarChartAriaLabel,
  resolveNavMonthLabels,
} from "@/lib/admin/nav-bar-chart";
import { cn } from "@/lib/cn";
import type { NavPoint } from "@/lib/data/dashboard";

/** NAV slot — muted shell when no live series; bar chart fills the hero cell. */
export function NavSlot({
  navPoints,
  lastNav,
  navDelta,
  navProvenance,
}: {
  navPoints: NavPoint[];
  lastNav: number | null;
  navDelta: number | null;
  navProvenance: Provenance;
}) {
  const isMuted = lastNav === null || navPoints.length < MIN_NAV_CHART_POINTS;

  return (
    <div className="dashboard-command-slot dashboard-command-slot--nav dashboard-nav-slot">
      <DashboardPanelHeader
        title="NAV trend · 30d"
        eyebrow="Analytics"
        tone="quiet"
        provenance={!isMuted ? navProvenance : undefined}
        className="dashboard-nav-slot__header"
      />
      <div className="dashboard-nav-slot__value-container">
        <p className="dashboard-nav-slot__value stat-value tabular m-0">
          {lastNav !== null ? (
            dashboardUsdCompact.format(lastNav)
          ) : (
            <span className="body-md ct-text-faint font-medium tracking-normal">Awaiting data</span>
          )}
        </p>
      </div>

      <NavBarChart points={navPoints} muted={isMuted} />

      {navDelta !== null ? (
        <p
          className={cn(
            "dashboard-nav-slot__delta body-xs tabular font-semibold m-0",
            navDelta >= 0 ? "ct-status-success" : "ct-status-danger",
          )}
        >
          {navDelta >= 0 ? "+" : ""}
          {navDelta.toFixed(1)}% · 30d
        </p>
      ) : null}
    </div>
  );
}

function NavBarChart({ points, muted = false }: { points: NavPoint[]; muted?: boolean }) {
  if (muted) {
    return (
      <div
        className="dashboard-nav-bars dashboard-nav-bars--muted flex items-center justify-center"
        role="img"
        aria-label="NAV trend — awaiting data"
      >
        <span className="body-sm ct-text-faint">No trend data available</span>
      </div>
    );
  }

  const slices = computeNavBarHeights(points);
  const activeSlices = slices.map((slice) => ({
    key: slice.date,
    heightPct: slice.heightPct,
    label: `${slice.date}: ${dashboardUsdFull.format(slice.aum_usdc)}`,
  }));
  const monthLabels = resolveNavMonthLabels(points);

  return (
    <div
      className={cn(
        "dashboard-nav-bars",
        monthLabels && "dashboard-nav-bars--monthly",
      )}
      style={{ "--dashboard-nav-bar-count": String(activeSlices.length) } as React.CSSProperties}
      role="img"
      aria-label={navBarChartAriaLabel(points)}
    >
      <div className="dashboard-nav-bars__plot">
        <div className="dashboard-nav-bars__grid" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="dashboard-nav-bars__bars" role="list">
          {activeSlices.map((slice) => (
            <div key={slice.key} className="dashboard-nav-bars__cell" role="listitem">
              <div
                className="dashboard-nav-bars__bar"
                style={{ height: `${slice.heightPct}%` }}
                tabIndex={0}
                aria-label={slice.label}
                title={slice.label}
              />
            </div>
          ))}
        </div>
      </div>
      {monthLabels ? (
        <div className="dashboard-nav-bars__months" aria-hidden>
          {monthLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
