import type { ReactNode } from "react";

import { DashboardPanelHeader } from "@/components/ui/system-panel";
import type { Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

const PREVIEW_LEAD =
  "Appears after your first active position — placeholders only until capital is deployed.";

export interface ProductSectionProps {
  title: string;
  provenance?: Provenance;
  /** When false, hides the “Verified data” label and header provenance badge. */
  showProvenance?: boolean;
  /**
   * active = Card premium module (populated portfolio).
   * preview = ct-section-preview frame at zero — no verified-data chrome.
   */
  variant?: "active" | "preview";
  children: ReactNode;
  className?: string;
  "data-section"?: string;
}

/** Canonical multi-widget section shell (DS — replaces portfolio MergedSurface). */
export function ProductSection({
  title,
  provenance,
  showProvenance = true,
  variant = "active",
  children,
  className,
  "data-section": dataSection,
}: ProductSectionProps) {
  if (variant === "preview") {
    return (
      <section
        className={cn("ct-section-preview", className)}
        data-section={dataSection}
      >
        <div className="ct-product-section__preview-head">
          <span className="eyebrow ct-text-faint">Preview</span>
          <h2 className="h2">{title}</h2>
          <p className="body-sm ct-text-muted ct-product-section__preview-lead">
            {PREVIEW_LEAD}
          </p>
        </div>
        <div className="ct-product-section__content">{children}</div>
      </section>
    );
  }

  return (
    <section
      className={cn("ct-product-section", className)}
      data-section={dataSection}
    >
      <DashboardPanelHeader
        eyebrow="Section"
        title={title}
        provenance={showProvenance ? provenance : undefined}
        trustLabel={
          showProvenance && provenance ? "Verified data" : undefined
        }
        tone="primary"
        className="ct-product-section__header border-b border-(--ct-border-soft) pb-4"
      />
      <div className="ct-product-section__content">{children}</div>
    </section>
  );
}
