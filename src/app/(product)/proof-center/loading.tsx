import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function ProofCenterLoading() {
  return (
    <div
      className="proof-center-shell proof-cockpit proof-cockpit--fit animate-in fade-in duration-(--ct-dur-slower)"
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
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
      </header>

      <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-40 mb-[var(--ct-space-3)]" variant="text" />
            <SkeletonCard />
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-48 mb-[var(--ct-space-3)]" variant="text" />
            <SkeletonCard />
          </div>
        </div>
      </div>

      <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-44 mb-[var(--ct-space-3)]" variant="text" />
            <SkeletonCard />
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-40 mb-[var(--ct-space-3)]" variant="text" />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}
