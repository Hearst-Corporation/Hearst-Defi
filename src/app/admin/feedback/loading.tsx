import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-[var(--ct-dur-slower)]">
      {/* Header */}
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-24" variant="text" />
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Feedback form */}
      <SkeletonCard />

      {/* Latest list */}
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-32" variant="text" />
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
