import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function VaultsLoading() {
  return (
    <div className="admin-doc-shell animate-in fade-in duration-[var(--ct-dur-slower)]">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-24" variant="text" />
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="admin-doc-stack">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
