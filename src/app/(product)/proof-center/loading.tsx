import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProofCenterLoading() {
  return (
    <div
      className="proof-center-shell animate-in fade-in duration-(--ct-dur-slower)"
      aria-busy="true"
      aria-label="Loading proof center"
    >
      <header className="product-page-header">
        <div className="product-page-header__row">
          <div className="product-page-header__main">
            <div className="product-page-header__title-stack">
              <Skeleton className="h-3 w-36" variant="text" />
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-full max-w-2xl" variant="text" />
              <Skeleton className="h-4 w-full max-w-xl" variant="text" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
      </header>

      <SkeletonCard />
      <SkeletonCard />

      <div className="product-doc-stack">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>

      <div className="product-doc-stack">
        <Skeleton className="h-8 w-72" />
        <SkeletonCard />
      </div>
    </div>
  );
}
