import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

import "../admin-proof.css";

export default function ProofCenterLoading() {
  return (
    <div
      className="proof-center-shell proof-cockpit admin-doc-shell animate-in fade-in duration-(--ct-dur-slower)"
      aria-busy="true"
      aria-label="Loading proof center"
    >
      <div className="admin-doc-stack--tight">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--actions">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96" variant="text" />
      </div>

      <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-40 proof-skeleton-title" variant="text" />
            <SkeletonCard />
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-48 proof-skeleton-title" variant="text" />
            <SkeletonCard />
          </div>
        </div>
      </div>

      <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-44 proof-skeleton-title" variant="text" />
            <SkeletonCard />
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <Skeleton className="h-5 w-40 proof-skeleton-title" variant="text" />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}
