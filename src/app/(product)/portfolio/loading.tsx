import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-recap" />
      </div>

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <Skeleton className="pf-skeleton-chart" />
            </div>
            <aside className="pf-hero-sidebar">
              <Skeleton className="pf-skeleton-sidebar" />
            </aside>
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

        <div className="pf-cockpit-row pf-cockpit-row--trio">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel" />
          </div>
        </div>
      </div>
    </div>
  );
}
