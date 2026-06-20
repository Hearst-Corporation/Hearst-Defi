import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the live cockpit bento (hero + mid + deck). */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-(--ct-dur-slower)">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <Skeleton className="pf-skeleton-chart" />
            </div>
            <Skeleton className="pf-skeleton-sidebar" />
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
        </div>

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
