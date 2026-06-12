/** Compact header chip — honest preview label (not Live / Stale / Verified). */
export function PreviewModeChip({
  label = "Preview mode",
}: {
  label?: string;
}) {
  return (
    <span
      data-preview-chip
      className="inline-flex items-center rounded-full border border-(--ct-border-soft) px-2.5 py-1 body-xs ct-text-faint uppercase ct-tracking-wide shrink-0"
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
      className="rounded-lg border border-(--ct-border-soft) px-4 py-3 ct-surface-1"
      role="note"
      data-testid="portfolio-layout-preview-banner"
    >
      <p className="body-sm ct-text-muted m-0">
        <span className="stat-label ct-text-accent mr-2">Layout preview</span>
        Portfolio structure shown at zero until your first active position.
        Projections are{" "}
        <strong className="ct-text-body font-medium">not guaranteed</strong>.
      </p>
    </div>
  );
}
