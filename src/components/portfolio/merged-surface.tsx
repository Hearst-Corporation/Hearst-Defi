import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

interface MergedSurfaceProps {
  title: string;
  provenance?: Provenance;
  /** When false, hides the “Verified data” label and header provenance badge. */
  showProvenance?: boolean;
  /**
   * active = premium glass module (populated portfolio).
   * preview = light section shell at zero — no dash-cell-premium chrome.
   */
  variant?: "active" | "preview";
  children: ReactNode;
  className?: string;
  "data-section"?: string;
}

const PREVIEW_LEAD =
  "Appears after your first active position — structure shown at zero for orientation only.";

/**
 * Portfolio section shell — active module (`dash-cell-premium`) or preview tier
 * (`pf-section-light`). Preview replaces premium chrome; empty widgets inside
 * use `EmptySurface` / `AwaitingMetricState` (DS §9).
 */
export function MergedSurface({
  title,
  provenance,
  showProvenance = true,
  variant = "active",
  children,
  className,
  "data-section": dataSection,
}: MergedSurfaceProps) {
  if (variant === "preview") {
    return (
      <section
        className={cn("pf-section-light", className)}
        data-section={dataSection}
      >
        <div className="pf-zero-section-head">
          <span className="eyebrow ct-text-faint">Preview</span>
          <h2 className="h2">{title}</h2>
          <p className="body-sm ct-text-muted pf-zero-lead">{PREVIEW_LEAD}</p>
        </div>
        <div className="pf-merged-content">{children}</div>
      </section>
    );
  }

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
      <div className="pf-merged-content">{children}</div>
    </article>
  );
}
