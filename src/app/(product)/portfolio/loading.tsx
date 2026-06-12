import "./portfolio.css";

import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container flex flex-col gap-4 animate-in fade-in duration-(--ct-dur-slower)">
      {/* Greeting */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Hero — chart 8 / sidebar 4 */}
      <div className="dash-bento pf-secondary-grid pf-hero-grid">
        <div className="bento-col-8 pf-main-chart-wrapper min-h-[22rem]">
          <SkeletonCard />
        </div>
        <div className="bento-col-4 flex flex-col gap-3 pf-secondary-panel">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* Yield stack + allocation */}
      <div className="dash-bento pf-secondary-grid">
        <div className="bento-col-8 min-h-48">
          <SkeletonCard />
        </div>
        <div className="bento-col-4 min-h-48">
          <SkeletonCard />
        </div>
      </div>

      {/* Positions */}
      <div className="dash-bento pf-secondary-grid">
        <div className="bento-col-12 min-h-40">
          <SkeletonCard />
        </div>
      </div>

      {/* Activity + calendar */}
      <div className="dash-bento pf-secondary-grid">
        <div className="bento-col-8 min-h-40">
          <SkeletonCard />
        </div>
        <div className="bento-col-4 min-h-40">
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
