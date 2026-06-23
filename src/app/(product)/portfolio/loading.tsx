import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the live cockpit layout (status banner + chart/positions + deck). */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-(--ct-dur-slower)">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-cockpit">
        {/* ROW 1 — Status banner */}
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
        </div>

        {/* ROW 2 — Chart + Positions */}
        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <div className="pf-cockpit-cell pf-fused-surface pf-fused-surface--chart-positions">
            <Skeleton className="pf-skeleton-chart" />
            <Skeleton className="pf-skeleton-widget" />
          </div>
        </div>

        {/* ROW 3 — Deck */}
        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget--md" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget--md" />
          </div>
        </div>
      </div>
    </div>
  );
}
