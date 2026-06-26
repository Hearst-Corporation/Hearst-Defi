import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

function DeckSkeleton() {
  return (
    <div className="pf-cockpit-panel">
      <div className="pf-deck-grid">
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
    <div className="pf-container animate-in fade-in duration-(--ct-dur-slower)">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-hairline" aria-hidden="true" />

      <div className="pf-cockpit">
        {/* HERO — Portfolio Value (chart welded with portfolio status) */}
        <div className="pf-cockpit-row pf-cockpit-row--chart">
          <div className="pf-cockpit-panel">
            <div className="pf-hero-grid">
              <div className="pf-main-chart-wrapper">
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
        </div>

        {/* NIVEAU 2 — Positions | Capital & Yield */}
        <div className="pf-cockpit-row pf-cockpit-row--pair">
          <div className="pf-cockpit-panel">
            <div className="pf-pair-grid">
              <div className="pf-embedded-pane pf-positions-badges">
                <div className="pf-cockpit-panel__header">
                  <Skeleton className="h-6 w-28 opacity-40" />
                  <Skeleton className="h-5 w-16 opacity-20" />
                </div>
                <div className="pf-positions-stack">
                  {[0, 1].map((i) => (
                    <div key={i} className="pf-position-card h-[88px] px-5 py-4 flex items-center gap-5">
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
              <div className="pf-embedded-pane">
                <div className="pf-cockpit-panel__header">
                  <Skeleton className="h-6 w-48 opacity-40" />
                  <Skeleton className="h-6 w-24 opacity-20" />
                </div>
                <div className="cy-v5-body">
                  <div className="cy-v5-headline">
                    {[0, 1].map((i) => (
                      <div key={i} className="cy-v5-metric">
                        <Skeleton className="h-2 w-20 opacity-20 mb-1" />
                        <Skeleton className="h-6 w-24 opacity-40" />
                      </div>
                    ))}
                  </div>
                  <div className="cy-v5-visual">
                    <Skeleton className="h-[92px] w-[92px] rounded-full opacity-20 shrink-0" />
                    <div className="flex flex-col gap-3 flex-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-2.5 w-2.5 rounded-sm opacity-30" />
                          <Skeleton className="h-3 w-32 flex-1 opacity-20" />
                          <Skeleton className="h-3 w-8 opacity-30" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NIVEAU 3 — Payout calendar + Recent activity (support) */}
        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <DeckSkeleton />
        </div>
      </div>
    </div>
  );
}
