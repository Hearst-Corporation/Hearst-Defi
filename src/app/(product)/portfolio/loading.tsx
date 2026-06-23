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

      <div className="pf-cockpit pf-terminal-workspace">
        {/* PLATE 1 */}
        <div className="pf-terminal-col">
          <div className="pf-terminal-cell flex-[1.5]"><Skeleton className="pf-embedded-pane min-h-[16rem]" /></div>
          <div className="pf-terminal-cell flex-1"><Skeleton className="pf-embedded-pane min-h-[12rem]" /></div>
          <div className="pf-terminal-cell flex-1"><Skeleton className="pf-embedded-pane min-h-[12rem]" /></div>
        </div>

        {/* PLATE 2 */}
        <div className="pf-terminal-col">
          <div className="pf-terminal-cell flex-none"><Skeleton className="pf-embedded-pane min-h-[10rem]" /></div>
          <div className="pf-terminal-cell flex-1"><Skeleton className="pf-embedded-pane min-h-[30rem]" /></div>
        </div>
      </div>
    </div>
  );
}
