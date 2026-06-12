import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function ProofCenterLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="admin-doc-stack--tight">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96" />
      </div>

      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
