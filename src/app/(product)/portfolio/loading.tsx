import "./portfolio.css";

import { MergedSurface } from "@/components/portfolio/merged-surface";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container animate-in fade-in duration-(--ct-dur-slower)">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <MergedSurface
        title="Performance & Liquidity"
        showProvenance={false}
        className="pf-hero-section"
        data-section="hero-pulse"
      >
        <div className="dash-bento pf-secondary-grid pf-hero-grid">
          <div className="bento-col-8 pf-main-chart-wrapper">
            <Skeleton className="min-h-88 w-full rounded-lg" />
          </div>
          <aside className="bento-col-4 pf-hero-sidebar">
            <Skeleton className="min-h-48 w-full" />
          </aside>
        </div>
      </MergedSurface>

      <div className="flex flex-col gap-4">
        <div className="dash-bento pf-secondary-grid" data-section="yield-allocation">
          <div className="bento-col-8 pf-cockpit-slot min-h-48">
            <Skeleton className="pf-cockpit-panel h-full w-full" />
          </div>
          <div className="bento-col-4 pf-cockpit-slot min-h-48">
            <Skeleton className="pf-cockpit-panel h-full w-full" />
          </div>
        </div>

        <MergedSurface
          title="Yield & Trust Pulse"
          showProvenance={false}
          className="pf-yield-trust-section"
          data-section="yield-trust"
        >
          <div className="dash-bento pf-secondary-grid">
            <div className="bento-col-4 pf-cockpit-slot min-h-40">
              <Skeleton className="pf-cockpit-panel h-full w-full" />
            </div>
            <div className="bento-col-4 pf-cockpit-slot min-h-40">
              <Skeleton className="pf-cockpit-panel h-full w-full" />
            </div>
            <div className="bento-col-4 pf-cockpit-slot min-h-40">
              <Skeleton className="pf-cockpit-panel h-full w-full" />
            </div>
          </div>
        </MergedSurface>
      </div>

      <div className="flex flex-col gap-4">
        <div className="dash-bento pf-secondary-grid" data-section="positions">
          <div className="bento-col-12 pf-cockpit-slot min-h-40">
            <Skeleton className="pf-cockpit-panel pf-cockpit-panel--table h-full w-full" />
          </div>
        </div>

        <MergedSurface
          title="Activity & Payouts"
          showProvenance={false}
          className="pf-activity-payouts-section"
          data-section="activity-payouts"
        >
          <div className="dash-bento pf-secondary-grid pf-activity-payouts-grid">
            <div className="bento-col-8 pf-cockpit-slot min-h-40">
              <Skeleton className="pf-cockpit-panel w-full" />
            </div>
            <div className="bento-col-4 pf-cockpit-slot min-h-28">
              <Skeleton className="pf-cockpit-panel w-full" />
            </div>
          </div>
        </MergedSurface>
      </div>
    </div>
  );
}
