import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

interface MergedSurfaceProps {
  title: string;
  provenance?: Provenance;
  /** When false, hides the “Verified data” label and header provenance badge. */
  showProvenance?: boolean;
  children: ReactNode;
  className?: string;
  "data-section"?: string;
}

/**
 * A premium container for merging multiple widgets into a single visual surface.
 * Handles the unified header and the consistent glassmorphism styling.
 */
export function MergedSurface({
  title,
  provenance,
  showProvenance = true,
  children,
  className,
  "data-section": dataSection,
}: MergedSurfaceProps) {
  return (
    <article
      className={cn("dash-cell dash-cell-premium pf-merged-surface", className)}
      data-section={dataSection}
    >
      <div className="pf-merged-header">
        <div className="flex flex-col gap-1">
          <span className="eyebrow ct-text-accent">Section</span>
          <h3 className="h3">{title}</h3>
        </div>
        {showProvenance && provenance ? (
          <div className="flex items-center gap-3">
            <span className="body-xs ct-text-faint italic hidden sm:inline">
              Verified data
            </span>
            <ProvenanceBadge kind={provenance} />
          </div>
        ) : null}
      </div>
      <div className="pf-merged-content">
        {children}
      </div>
    </article>
  );
}
