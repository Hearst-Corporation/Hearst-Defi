import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ScenarioLabLoading() {
  return (
    <div className="admin-doc-shell--roomy scenario-lab-page">
      <div className="admin-doc-stack--relaxed">
        <Skeleton className="h-3 w-40" />
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed items-start">
          <Skeleton className="h-10 w-56" />
          <div className="admin-doc-inline-row">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <div className="scenario-lab-shell">
        <div className="scenario-lab-toolbar">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-44" />
        </div>

        <Skeleton className="h-28 w-full shrink-0 rounded-xl" />

        <div className="scenario-lab-workspace">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
