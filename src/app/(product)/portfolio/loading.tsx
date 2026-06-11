import "./portfolio.css";

import { SkeletonCard, SkeletonMetric, Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="pf-container flex flex-col gap-3 md:gap-6 animate-in fade-in duration-(--ct-dur-slower)">
      {/* Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-2">
        <div className="space-y-2">
          <SkeletonMetric />
          <Skeleton className="h-16 w-64" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Allocation donut + value chart */}
      <div className="grid gap-8 lg:grid-cols-3">
        <SkeletonCard />
        <div className="lg:col-span-2">
          <SkeletonCard />
        </div>
      </div>

      {/* Positions + recent activity */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}
