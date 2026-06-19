import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function MonitoringLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--compact">
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI strip is conditional on page — thin placeholder, not a fixed 4-grid */}
      <div className="dashboard-cockpit-panel admin-kpi-strip-panel">
        <div className="admin-doc-inline-row admin-doc-inline-row--loose">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="admin-doc-stack--relaxed">
        <Skeleton className="h-7 w-48" variant="text" />
        <SkeletonCard />
      </div>

      <div className="admin-doc-stack--relaxed">
        <Skeleton className="h-7 w-40" variant="text" />
        <SkeletonCard />
      </div>
    </div>
  );
}
