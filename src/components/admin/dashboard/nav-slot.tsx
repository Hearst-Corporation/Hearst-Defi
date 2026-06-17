import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { dashboardUsdCompact, dashboardUsdFull } from "@/lib/admin/dashboard-formatters";
import { computeNavBarHeights, MIN_NAV_CHART_POINTS, navBarChartAriaLabel } from "@/lib/admin/nav-bar-chart";
import { cn } from "@/lib/cn";
import type { NavPoint } from "@/lib/data/dashboard";

/** Placeholder — 6 monthly bars, aligned with axis labels. */
const NAV_PLACEHOLDER_HEIGHTS = [34, 48, 42, 56, 50, 62] as const;
const NAV_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const;

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
      <header className="dashboard-nav-slot__header">
        <div className="min-w-0">
          <h3 className="h3 ct-text-body m-0">NAV trend · 30d</h3>
          <p className="dashboard-nav-slot__value stat-value tabular">
            {lastNav !== null ? dashboardUsdCompact.format(lastNav) : "—"}
          </p>
        </div>
        <ProvenanceBadge kind={navProvenance} variant="strip" />
      </header>

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
  const slices = computeNavBarHeights(points);
  const placeholderSlices = NAV_PLACEHOLDER_HEIGHTS.map((heightPct, index) => ({
    key: `placeholder-${index}`,
    heightPct,
    label: undefined,
  }));
  const activeSlices = slices.map((slice) => ({
    key: slice.date,
    heightPct: slice.heightPct,
    label: `${slice.date}: ${dashboardUsdFull.format(slice.aum_usdc)}`,
  }));
  const renderedSlices = muted ? placeholderSlices : activeSlices;
  const showMonthAxis = renderedSlices.length === NAV_MONTH_LABELS.length;

  return (
    <div
      className={cn(
        "dashboard-nav-bars",
        muted && "dashboard-nav-bars--muted",
        showMonthAxis && "dashboard-nav-bars--monthly",
      )}
      style={{ "--dashboard-nav-bar-count": String(renderedSlices.length) } as React.CSSProperties}
      role="img"
      aria-label={muted ? "NAV trend — awaiting data" : navBarChartAriaLabel(points)}
    >
      <div className="dashboard-nav-bars__plot">
        <div className="dashboard-nav-bars__grid" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="dashboard-nav-bars__bars" role="list">
          {renderedSlices.map((slice) => (
            <div key={slice.key} className="dashboard-nav-bars__cell" role="listitem">
              <div
                className="dashboard-nav-bars__bar"
                style={{ height: `${slice.heightPct}%` }}
                tabIndex={muted ? -1 : 0}
                aria-label={muted ? undefined : slice.label}
                title={muted ? undefined : slice.label}
              />
            </div>
          ))}
        </div>
      </div>
      {showMonthAxis ? (
        <div className="dashboard-nav-bars__months" aria-hidden>
          {NAV_MONTH_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
