/** Compact header chip — honest preview label (not Live / Stale / Verified). */
export function PreviewModeChip({
  label = "Preview mode",
}: {
  label?: string;
}) {
  return (
    <span
      data-preview-chip
      className="pf-preview-mode-chip body-xs ct-text-faint uppercase ct-tracking-wide"
    >
      {label}
    </span>
  );
}

/**
 * Layout preview — full portfolio structure at zero before the first LP position.
 * DS: values are explicitly non-live; sections use preview tier (no Stale/Live badges).
 */
export function LayoutPreviewBanner() {
  return (
    <div
      className="pf-layout-preview-banner ct-surface-1"
      role="note"
      data-testid="portfolio-layout-preview-banner"
    >
      <p className="pf-layout-preview-banner__copy body-sm ct-text-muted">
        <span className="stat-label ct-text-accent">Layout preview</span>
        <span>
        Portfolio structure shown at zero until your first active position.
        Projections are{" "}
        <strong className="ct-text-body font-medium">not guaranteed</strong>.
        </span>
      </p>
    </div>
  );
}
