import "./portfolio.css";

import { ProductSection } from "@/components/ui/product-section";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-recap" />
      </div>

      <div className="pf-skeleton-widget--md" data-section="positions">
        <Skeleton className="pf-cockpit-panel pf-cockpit-panel--table h-full w-full" />
      </div>

      <ProductSection
        title="Performance & Liquidity"
        eyebrow="Portfolio"
        showProvenance={false}
        className="pf-hero-section"
        data-section="hero-pulse"
      >
        <div className="pf-hero-grid">
          <div className="pf-main-chart-wrapper">
            <Skeleton className="pf-skeleton-chart" />
          </div>
          <aside className="pf-hero-sidebar">
            <Skeleton className="pf-skeleton-sidebar" />
          </aside>
        </div>
      </ProductSection>

      <div className="pf-section-stack">
        <div className="pf-skeleton-widget" data-section="yield-allocation">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>

        <ProductSection
          title="Activity & trust"
          eyebrow="Activity"
          showProvenance={false}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="pf-activity-grid">
            <div className="pf-activity-grid__cell pf-skeleton-widget--md">
              <Skeleton className="pf-cockpit-panel w-full h-full" />
            </div>
            <div
              className="pf-activity-grid__cell pf-skeleton-widget--sm"
              data-section="yield-trust"
            >
              <Skeleton className="pf-cockpit-panel w-full h-full" />
            </div>
          </div>
        </ProductSection>

        <div className="pf-payout-calendar-slot pf-skeleton-widget" data-section="payout-calendar">
          <Skeleton className="pf-cockpit-panel pf-payout-calendar-panel w-full min-h-[14rem]" />
        </div>
      </div>
    </div>
  );
}
