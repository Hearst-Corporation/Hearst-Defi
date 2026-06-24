import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProductWorkspaceLoading() {
  return (
    <div className="admin-doc-shell--roomy animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="admin-doc-section">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="admin-doc-section admin-doc-divider-section">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-full max-w-xl" />
      </div>

      <div className="admin-doc-split-grid admin-doc-split-grid--brief">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="admin-doc-section">
        <Skeleton className="h-8 w-48" />
        <div className="admin-doc-card-grid-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
