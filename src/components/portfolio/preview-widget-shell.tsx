import type { ReactNode } from "react";

import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";

interface PreviewWidgetShellProps {
  title: string;
  provenance: Provenance;
  ariaLabel: string;
  meta?: ReactNode;
  children: ReactNode;
}

/** Shared dash-cell-premium header for layout-preview empty widgets (DS §6). */
export function PreviewWidgetShell({
  title,
  provenance,
  ariaLabel,
  meta,
  children,
}: PreviewWidgetShellProps) {
  return (
    <article
      className="dash-cell dash-cell-premium flex flex-col"
      aria-label={ariaLabel}
    >
      <div className="pf-widget-header">
        <h3 className="h3">{title}</h3>
        <span className="dash-label-meta">
          <ProvenanceBadge kind={provenance} />
          {meta}
        </span>
      </div>
      {children}
    </article>
  );
}
