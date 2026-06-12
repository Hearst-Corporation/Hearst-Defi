import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
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
      <div className="dashboard-command-slot dashboard-command-slot--nav">
        <EmptySurface
          variant="chart"
          className="dashboard-command-nav-empty"
          message="NAV trend appears after seven days of booked snapshots."
        />
      </div>
    );
  }

  return (
    <Card className="dashboard-command-slot dashboard-command-slot--nav">
      <div className="dashboard-command-performance">
        <header className="dashboard-card-header ct-system-panel__header dashboard-command-performance__header">
          <div className="min-w-0">
            <h3 className="h3 ct-text-body m-0">NAV · 30d</h3>
            <p className="stat-value tabular mt-1">
              {lastNav !== null && lastNav > 0 ? usdCompact.format(lastNav) : "—"}
            </p>
          </div>
          <ProvenanceBadge kind={navProvenance} variant="strip" />
        </header>

        <NavBarChart points={navPoints} />

        {navDelta !== null ? (
          <div className="dashboard-command-performance__footer">
            <span
              className={cn(
                "body-xs font-semibold tabular",
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
  const values = points.map((point) => point.aum_usdc);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;

  return (
    <div
      className="dashboard-nav-bars"
      style={{ "--dashboard-nav-bar-count": String(points.length) } as React.CSSProperties}
      role="img"
      aria-label="NAV trend over 30 days"
    >
      {points.map((point) => {
        const normalized = max === min ? 1 : (point.aum_usdc - min) / span;
        const heightPct = Math.max(10, Math.round(normalized * 100));
        return (
          <div key={point.date} className="dashboard-nav-bars__cell">
            <div
              className="dashboard-nav-bars__bar"
              style={{ height: `${heightPct}%` }}
              title={`${point.date}: ${usdFull.format(point.aum_usdc)}`}
            />
          </div>
        );
      })}
    </div>
  );
}
