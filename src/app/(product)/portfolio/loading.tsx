import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container flex flex-col gap-4 animate-in fade-in duration-(--ct-dur-slower)">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="dash-bento pf-secondary-grid">
        <div className="bento-col-8 pf-main-chart-wrapper min-h-[22rem]">
          <Skeleton className="h-full min-h-[22rem] w-full rounded-lg" />
        </div>
        <div className="bento-col-4 pf-hero-sidebar min-h-[22rem]">
          <Skeleton className="h-full min-h-48 w-full" />
        </div>
      </div>

      <div className="dash-bento pf-secondary-grid" data-section="yield-allocation">
        <div className="bento-col-8 pf-cockpit-slot min-h-48">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>
        <div className="bento-col-4 pf-cockpit-slot min-h-48">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>
      </div>

      <div className="dash-bento pf-secondary-grid" data-section="yield-trust">
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

      <div className="dash-bento pf-secondary-grid" data-section="positions">
        <div className="bento-col-12 pf-cockpit-slot min-h-40">
          <Skeleton className="pf-cockpit-panel pf-cockpit-panel--table h-full w-full" />
        </div>
      </div>

      <div className="dash-bento pf-secondary-grid" data-section="activity-payouts">
        <div className="bento-col-8 pf-cockpit-slot min-h-40">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>
        <div className="bento-col-4 pf-cockpit-slot min-h-40">
          <Skeleton className="pf-cockpit-panel h-full w-full" />
        </div>
      </div>
    </div>
  );
}
