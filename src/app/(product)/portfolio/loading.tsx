import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function FusedSkeleton({ variant }: { variant: "mid" | "deck" }) {
  return (
    <div className={cn("pf-fused-surface", `pf-fused-surface--${variant}`)}>
      <div className="pf-fused-surface__pane">
        <div className="pf-embedded-pane">
          <div className="pf-cockpit-panel__header">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="pf-distrib-chart-shell mt-2">
            <div className="flex items-end justify-between h-full w-full px-4 pb-8">
              {[60, 40, 70, 50, 80, 60, 90, 70, 100, 80, 110, 90].map((h, i) => (
                <div key={i} className="pf-skeleton-bar w-[6%] rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
        <div className="pf-embedded-pane">
          <div className="pf-cockpit-panel__header">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex flex-col gap-4 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mirrors the live cockpit bento (hero + mid + deck). */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-(--ct-dur-slower)" style={{ 
      background: "radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--ct-accent) 3%, transparent), var(--ct-surface-2) 60%)" 
    }}>
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--chart">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper">
              <Skeleton className="pf-skeleton-chart" />
            </div>
            <Skeleton className="pf-skeleton-sidebar" />
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--yield">
          <div className="pf-cockpit-cell">
            <div className="pf-cockpit-panel cy-panel">
              <div className="pf-cockpit-panel__header">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="cy-body">
                <div className="cy-donut dash-chart-container">
                  <Skeleton className="h-full w-full rounded-full" />
                </div>
                <div className="cy-spine" />
                <div className="cy-ledger">
                  <Skeleton className="h-4 w-full mb-4" />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 mb-2">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <FusedSkeleton variant="deck" />
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--positions">
          <div className="pf-cockpit-cell">
            <div className="pf-positions-stack">
              {[0, 1].map((i) => (
                <div key={i} className="pf-position-card h-[88px] p-6 flex items-center gap-6">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="w-32">
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <div className="w-32">
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
