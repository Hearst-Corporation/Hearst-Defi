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

      <div className="pf-teaser-grid">
        <Skeleton className="pf-cockpit-panel pf-teaser" />
        <Skeleton className="pf-cockpit-panel pf-teaser" />
        <Skeleton className="pf-cockpit-panel pf-teaser" />
        <Skeleton className="pf-cockpit-panel pf-teaser" />
      </div>
    </div>
  );
}
