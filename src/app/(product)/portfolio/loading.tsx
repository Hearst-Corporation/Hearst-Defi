import "./portfolio.css";

import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the live cockpit layout (status banner + chart/positions + deck). */
export default function PortfolioLoading() {
  return (
    <div className="pf-container pf-container--fit animate-in fade-in duration-(--ct-dur-slower)">
      <div className="pf-greeting">
        <Skeleton className="pf-skeleton-greeting-title" />
        <Skeleton className="pf-skeleton-greeting-ticker" />
      </div>

      <div className="pf-cockpit pf-terminal-surface">
        <div className="pf-terminal-pane pf-terminal-pane--left">
          <Skeleton className="pf-embedded-pane h-[300px]" />
          <div className="pf-terminal-divider" aria-hidden="true" />
          <Skeleton className="pf-embedded-pane h-[200px]" />
          <div className="pf-terminal-divider" aria-hidden="true" />
          <Skeleton className="pf-embedded-pane h-[280px]" />
        </div>
        <div className="pf-terminal-pane pf-terminal-pane--right">
          <Skeleton className="pf-embedded-pane h-[180px]" />
          <div className="pf-terminal-divider" aria-hidden="true" />
          <Skeleton className="pf-embedded-pane h-[240px]" />
          <div className="pf-terminal-divider" aria-hidden="true" />
          <Skeleton className="pf-embedded-pane h-[200px]" />
        </div>
      </div>
    </div>
  );
}
