import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function MonitoringLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-(--ct-dur-slower)">
      <div className="space-y-1">
        <Skeleton className="h-12 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <SkeletonCard />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <SkeletonCard />
      </div>
    </div>
  );
}
