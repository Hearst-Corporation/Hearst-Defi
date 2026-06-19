import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the live cockpit bento (hero + mid + trio) so the skeleton matches
 *  the rendered layout — no onboarding-shaped flash. */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-recap" />
      </div>

      <div className="pf-cockpit">
        {/* Hero — chart + KPI rail */}
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

        {/* Positions & allocation */}
        <h2 className="h2 pf-section-head">Positions &amp; allocation</h2>
        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget" />
          </div>
        </div>

        {/* Distributions & proof */}
        <h2 className="h2 pf-section-head">Distributions &amp; proof</h2>
        <div className="pf-cockpit-row pf-cockpit-row--trio">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget--md" />
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
