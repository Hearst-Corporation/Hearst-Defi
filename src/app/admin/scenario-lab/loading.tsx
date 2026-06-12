import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ScenarioLabLoading() {
  return (
    <div className="scenario-lab-page">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-40" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Skeleton className="h-10 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <div className="scenario-lab-shell space-y-4">
        <div className="scenario-lab-toolbar">
          <Skeleton className="h-11 w-52 rounded-full" />
          <Skeleton className="h-11 w-44 rounded-full" />
        </div>

        <Skeleton className="h-28 w-full rounded-xl" />

        <div className="scenario-lab-workspace">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
