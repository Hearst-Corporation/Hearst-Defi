import type { ReactNode } from "react";

import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
  /** Preview section lead copy. Pass `false` to omit (e.g. when a page banner already explains preview). */
  previewLead?: string | false;
  /** When false, omit preview eyebrow + title (page banner carries preview context). */
  showPreviewHead?: boolean;
  children: ReactNode;
  className?: string;
  "data-section"?: string;
}

/** Canonical multi-widget section shell (DS). */
export function ProductSection({
  title,
  provenance,
  showProvenance = true,
  variant = "active",
  previewLead = PREVIEW_LEAD,
  showPreviewHead = true,
  children,
  className,
  "data-section": dataSection,
}: ProductSectionProps) {
  if (variant === "preview") {
    return (
      <section
        className={cn(
          "ct-section-preview",
          !showPreviewHead && "ct-section-preview--content-only",
          className,
        )}
        data-section={dataSection}
        aria-label={showPreviewHead ? undefined : title}
      >
        {showPreviewHead ? (
          <div className="ct-product-section__preview-head">
            <span className="eyebrow ct-text-faint">Preview</span>
            <h2 className="h2">{title}</h2>
            {previewLead !== false ? (
              <p className="body-sm ct-text-muted ct-product-section__preview-lead">
                {previewLead}
              </p>
            ) : null}
          </div>
        ) : null}
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
        titleLevel="section"
        provenance={showProvenance ? provenance : undefined}
        trustLabel={
          showProvenance && provenance ? "Verified data" : undefined
        }
        tone="primary"
        className="ct-product-section__header"
      />
      <div className="ct-product-section__content">{children}</div>
    </section>
  );
}
