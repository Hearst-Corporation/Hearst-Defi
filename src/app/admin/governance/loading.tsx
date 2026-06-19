import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function GovernanceLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-32" variant="text" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="admin-doc-stack">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
