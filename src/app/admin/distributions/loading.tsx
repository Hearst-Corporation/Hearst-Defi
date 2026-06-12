import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DistributionsLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-28" variant="text" />
        <Skeleton className="h-10 w-44" />
      </div>

      <SkeletonCard />

      <div className="admin-doc-stack">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
