import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors previewZeros onboarding layout — no chart-shaped skeleton flash. */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--zero pf-container--onboarding animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-recap" />
      </div>

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--summary">
          <div className="pf-hero-grid pf-hero-grid--onboarding pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <Skeleton className="pf-cockpit-panel pf-skeleton-onboarding-hero" />
            </div>
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--onboarding-foot">
          <div className="pf-cockpit-cell">
            <Skeleton className="pf-cockpit-panel pf-skeleton-widget--sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
