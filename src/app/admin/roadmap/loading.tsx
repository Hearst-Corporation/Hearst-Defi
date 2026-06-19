import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function RoadmapLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-24" variant="text" />
        <Skeleton className="h-12 w-48" />
      </div>

      <div className="max-w-xl">
        <SkeletonCard />
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="admin-doc-stack">
          <Skeleton className="h-7 w-48" />
          <div className="admin-doc-stack">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ))}
    </div>
  );
}
