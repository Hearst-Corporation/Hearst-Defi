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

      <div className="dash-bento pf-secondary-grid" data-section="positions">
        <div className="bento-col-12 pf-cockpit-slot pf-skeleton-widget--md">
          <Skeleton className="pf-cockpit-panel pf-cockpit-panel--table h-full w-full" />
        </div>
      </div>

      <ProductSection
        title="Performance & Liquidity"
        eyebrow="Portfolio"
        showProvenance={false}
        className="pf-hero-section"
        data-section="hero-pulse"
      >
        <div className="dash-bento pf-secondary-grid pf-hero-grid">
          <div className="bento-col-8 pf-main-chart-wrapper">
            <Skeleton className="pf-skeleton-chart" />
          </div>
          <aside className="bento-col-4 pf-hero-sidebar">
            <Skeleton className="pf-skeleton-sidebar" />
          </aside>
        </div>
      </ProductSection>

      <div className="pf-section-stack">
        <div className="pf-cockpit-slot pf-skeleton-widget" data-section="yield-allocation">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>

        <ProductSection
          title="Yield & Trust Pulse"
          eyebrow="Trust"
          showProvenance={false}
          className="pf-yield-trust-section"
          data-section="yield-trust"
        >
          <div className="pf-cockpit-slot pf-skeleton-widget">
            <Skeleton className="pf-cockpit-panel h-full w-full" />
          </div>
        </ProductSection>
      </div>

      <div className="pf-section-stack">
        <ProductSection
          title="Activity & Payouts"
          eyebrow="Activity"
          showProvenance={false}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="dash-bento pf-secondary-grid pf-activity-payouts-grid">
            <div className="bento-col-8 pf-cockpit-slot pf-skeleton-widget--md">
              <Skeleton className="pf-cockpit-panel w-full" />
            </div>
            <div className="bento-col-4 pf-cockpit-slot pf-skeleton-widget--sm">
              <Skeleton className="pf-cockpit-panel w-full" />
            </div>
          </div>
        </ProductSection>
      </div>
    </div>
  );
}
