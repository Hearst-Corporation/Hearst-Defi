import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function FusedSkeleton({ variant }: { variant: "mid" | "deck" }) {
  return (
    <div className={cn("pf-fused-surface", `pf-fused-surface--${variant}`)}>
      <div className="pf-fused-surface__pane">
        <div className="pf-embedded-pane">
          <div className="pf-cockpit-panel__header">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-40 opacity-40" />
              <Skeleton className="h-4 w-24 opacity-20" />
            </div>
            <Skeleton className="h-6 w-20 opacity-30" />
          </div>
          <div className="pf-distrib-chart-shell mt-8">
            <div className="flex items-end justify-between h-full w-full px-6 pb-10">
              {[40, 60, 45, 75, 55, 85, 65, 95, 75, 90, 70, 80, 60].map((h, i) => (
                <div key={i} className="pf-skeleton-bar w-[5%] rounded-t-sm opacity-20" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="flex gap-10 mt-6 pt-6 border-t border-soft/30">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-2 w-16 opacity-20" />
              <Skeleton className="h-4 w-24 opacity-30" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-2 w-16 opacity-20" />
              <Skeleton className="h-4 w-24 opacity-30" />
            </div>
          </div>
        </div>
      </div>
      <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
        <div className="pf-embedded-pane">
          <div className="pf-cockpit-panel__header">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-32 opacity-40" />
              <Skeleton className="h-4 w-20 opacity-20" />
            </div>
          </div>
          <div className="flex flex-col gap-6 mt-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="pf-skeleton-glyph opacity-20" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-32 opacity-30" />
                  <Skeleton className="h-3 w-20 opacity-10" />
                </div>
                <Skeleton className="h-4 w-16 opacity-40" />
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
    <div className="pf-container pf-container--fit animate-in fade-in duration-(--ct-dur-slower) bg-(--ct-bg-deep)">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-cockpit">
        <div className="pf-cockpit-row pf-cockpit-row--chart">
          <div className="pf-hero-grid pf-cockpit-cell">
            <div className="pf-main-chart-wrapper min-h-[18rem]">
              <div className="pf-value-chart p-6 h-full flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-32 opacity-40" />
                    <Skeleton className="h-4 w-24 opacity-20" />
                  </div>
                  <Skeleton className="h-8 w-24 opacity-30" />
                </div>
                <div className="flex-1 flex items-baseline gap-3">
                  <Skeleton className="h-12 w-48 opacity-60" />
                  <Skeleton className="h-4 w-12 opacity-30" />
                </div>
                <div className="flex-1 relative">
                  <Skeleton className="absolute inset-0 opacity-10" />
                </div>
              </div>
            </div>
            <div className="pf-status-panel border-l border-nested">
              <div className="p-6 flex flex-col gap-6 h-full">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-32 opacity-40" />
                  <Skeleton className="h-4 w-20 opacity-20" />
                </div>
                <div className="flex flex-col gap-4 flex-1 justify-between py-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-1 rounded-full opacity-30" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-20 mb-1 opacity-30" />
                        <Skeleton className="h-3 w-16 opacity-10" />
                      </div>
                      <Skeleton className="h-6 w-12 opacity-40" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--yield">
          <div className="pf-cockpit-cell">
            <div className="pf-cockpit-panel cy-panel">
              <div className="pf-cockpit-panel__header">
                <Skeleton className="h-6 w-48 opacity-40" />
                <Skeleton className="h-6 w-24 opacity-20" />
              </div>
              <div className="cy-body mt-4">
                <div className="cy-donut dash-chart-container">
                  <Skeleton className="h-full w-full rounded-full opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-1">
                    <Skeleton className="h-6 w-16 opacity-30" />
                    <Skeleton className="h-4 w-12 opacity-10" />
                  </div>
                </div>
                <div className="cy-spine" />
                <div className="cy-ledger flex-1">
                  <Skeleton className="h-3 w-40 mb-6 opacity-20" />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-2 w-2 rounded-full opacity-30" />
                        <Skeleton className="h-3 flex-1 opacity-20" />
                        <Skeleton className="h-3 w-12 opacity-30" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full opacity-10" />
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
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="w-32">
                    <Skeleton className="h-5 w-16 mb-2" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                  <div className="w-32">
                    <Skeleton className="h-5 w-16 mb-2" />
                    <Skeleton className="h-7 w-20" />
                  </div>
                  <Skeleton className="h-6 w-6 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
