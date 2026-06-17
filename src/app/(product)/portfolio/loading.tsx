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
          title="Recent Activity"
          eyebrow="Activity"
          showProvenance={false}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="pf-activity-grid pf-activity-grid--lead-only">
            <div className="pf-skeleton-widget--md">
              <Skeleton className="pf-cockpit-panel w-full" />
            </div>
          </div>
        </ProductSection>

        <ProductSection
          title="Yield & Trust Pulse"
          eyebrow="Trust"
          showProvenance={false}
          className="pf-yield-trust-section"
          data-section="yield-trust"
        >
          <div className="pf-skeleton-widget">
            <Skeleton className="pf-cockpit-panel h-full w-full" />
          </div>
        </ProductSection>

        <div className="pf-skeleton-widget--sm" data-section="payout-calendar">
          <Skeleton className="pf-cockpit-panel w-full" />
        </div>
      </div>
    </div>
  );
}
