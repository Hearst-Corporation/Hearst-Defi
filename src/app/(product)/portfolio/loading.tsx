import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function FusedSkeleton({ variant }: { variant: "mid" | "deck" }) {
  return (
    <div className={cn("pf-fused-surface", `pf-fused-surface--${variant}`)}>
      <div className="pf-fused-surface__pane">
        <Skeleton className="pf-skeleton-widget" />
      </div>
      <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
        <Skeleton className="pf-skeleton-widget" />
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

        <div className="pf-cockpit-row pf-cockpit-row--mid">
          <FusedSkeleton variant="mid" />
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--deck">
          <FusedSkeleton variant="deck" />
        </div>

        <div className="pf-cockpit-row pf-cockpit-row--positions">
          <div className="pf-cockpit-cell">
            <div className="pf-positions-stack">
              {[0, 1, 2].map((i) => (
                <div key={i} className="pf-position-card pf-skeleton-widget h-[100px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
