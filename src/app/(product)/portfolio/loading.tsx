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
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[16rem] bg-transparent" /></div>
          <div className="pf-terminal-divider" aria-hidden="true" />
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[12rem] bg-transparent" /></div>
          <div className="pf-terminal-divider" aria-hidden="true" />
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[12rem] bg-transparent" /></div>
        </div>

        {/* PLATE 2 */}
        <div className="pf-terminal-col">
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[10rem] bg-transparent" /></div>
          <div className="pf-terminal-divider" aria-hidden="true" />
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[14rem] bg-transparent" /></div>
          <div className="pf-terminal-divider" aria-hidden="true" />
          <div className="pf-terminal-cell"><Skeleton className="pf-embedded-pane min-h-[16rem] bg-transparent" /></div>
        </div>
      </div>
    </div>
  );
}
