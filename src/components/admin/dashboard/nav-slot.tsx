import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { type Provenance } from "@/components/ui/provenance-badge";
import { dashboardUsdCompact, dashboardUsdFull } from "@/lib/admin/dashboard-formatters";
import {
  computeNavBarHeights,
  MIN_NAV_CHART_POINTS,
  NAV_CHART_SHELL_BAR_COUNT,
  NAV_PLACEHOLDER_MONTH_LABELS,
  navBarChartAriaLabel,
  navPlaceholderBarHeights,
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
      <p className="dashboard-nav-slot__value stat-value tabular m-0">
          {lastNav !== null ? (
            dashboardUsdCompact.format(lastNav)
          ) : (
            <span className="body-md ct-text-faint font-medium tracking-normal">Awaiting data</span>
          )}
      </p>

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

interface NavBarSliceView {
  key: string;
  heightPct: number;
  label?: string;
}

function NavBarChartShell({
  barCount,
  slices,
  monthLabels,
  muted,
  ariaLabel,
  caption,
}: {
  barCount: number;
  slices: NavBarSliceView[];
  monthLabels: readonly string[] | null;
  muted: boolean;
  ariaLabel: string;
  caption?: string;
}) {
  return (
    <div
      className={cn(
        "dashboard-nav-bars",
        monthLabels && "dashboard-nav-bars--monthly",
        muted && "dashboard-nav-bars--muted",
      )}
      style={{ "--dashboard-nav-bar-count": String(barCount) } as React.CSSProperties}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="dashboard-nav-bars__plot">
        <div className="dashboard-nav-bars__grid" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="dashboard-nav-bars__bars" role="list">
          {slices.map((slice) => (
            <div key={slice.key} className="dashboard-nav-bars__cell" role="listitem">
              <div
                className="dashboard-nav-bars__bar"
                style={{ height: `${slice.heightPct}%` }}
                tabIndex={slice.label ? 0 : undefined}
                aria-label={slice.label}
                title={slice.label}
                aria-hidden={slice.label ? undefined : true}
              />
            </div>
          ))}
        </div>
        {caption ? (
          <p className="dashboard-nav-bars__caption body-sm ct-text-faint m-0">{caption}</p>
        ) : null}
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

function NavBarChart({ points, muted = false }: { points: NavPoint[]; muted?: boolean }) {
  if (muted) {
    const placeholderHeights = navPlaceholderBarHeights(NAV_CHART_SHELL_BAR_COUNT);
    const slices = placeholderHeights.map((heightPct, index) => ({
      key: `placeholder-${index}`,
      heightPct,
    }));

    return (
      <NavBarChartShell
        barCount={NAV_CHART_SHELL_BAR_COUNT}
        slices={slices}
        monthLabels={NAV_PLACEHOLDER_MONTH_LABELS}
        muted
        ariaLabel="NAV trend — awaiting data"
        caption="No trend data available"
      />
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
    <NavBarChartShell
      barCount={activeSlices.length}
      slices={activeSlices}
      monthLabels={monthLabels}
      muted={false}
      ariaLabel={navBarChartAriaLabel(points)}
    />
  );
}
