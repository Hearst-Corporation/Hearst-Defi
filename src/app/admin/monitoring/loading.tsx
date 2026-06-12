import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function MonitoringLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--compact">
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="admin-doc-kpi-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="admin-doc-stack--relaxed">
        <Skeleton className="h-7 w-40" />
        <SkeletonCard />
      </div>

      <div className="admin-doc-stack--relaxed">
        <Skeleton className="h-7 w-40" />
        <SkeletonCard />
      </div>
    </div>
  );
}
