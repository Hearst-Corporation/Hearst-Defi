import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

interface ProofCenterLoadingProps {
  className?: string;
}

function SkeletonDataRoomItem() {
  return (
    <div className="flex items-start gap-(--ct-space-3) py-(--ct-space-4)">
      <Skeleton className="w-8 h-8 rounded-(--ct-radius-md) shrink-0" />
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" variant="text" />
        <div className="flex flex-col gap-1 mt-1">
          <Skeleton className="h-4 w-1/2" variant="text" />
          <Skeleton className="h-4 w-2/3" variant="text" />
        </div>
      </div>
    </div>
  );
}

export function ProofCenterLoading({ className }: ProofCenterLoadingProps) {
  return (
    <div
      className={cn(
        "proof-center-shell proof-cockpit animate-in fade-in duration-(--ct-dur-slower)",
        className,
      )}
      aria-busy="true"
      aria-label="Loading proof center"
    >
      <header className="product-page-header mb-(--ct-space-8)">
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
            <div className="dashboard-card-header items-center">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="proof-panel-scroll">
              <div className="flex flex-col gap-4 p-4">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" variant="text" />
                  <Skeleton className="h-4 w-2/3" variant="text" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <div className="dashboard-card-header items-center">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="proof-panel-scroll">
              <div className="flex flex-col gap-4 p-4">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-full" variant="text" />
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <div className="dashboard-card-header items-center">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="proof-panel-scroll">
              <div className="divide-y divide-(--ct-border-soft) px-4">
                <SkeletonDataRoomItem />
                <SkeletonDataRoomItem />
              </div>
            </div>
          </div>
        </div>
        <div className="dashboard-cockpit-cell">
          <div className="dashboard-cockpit-panel">
            <div className="dashboard-card-header items-center">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" variant="text" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="proof-panel-scroll">
              <div className="divide-y divide-(--ct-border-soft) px-4">
                <SkeletonDataRoomItem />
                <SkeletonDataRoomItem />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
