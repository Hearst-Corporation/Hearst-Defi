import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function RoadmapLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" variant="text" />
        <Skeleton className="h-12 w-48" />
      </div>

      <div className="max-w-xl">
        <SkeletonCard />
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="space-y-6">
          <Skeleton className="h-7 w-48" />
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ))}
    </div>
  );
}
