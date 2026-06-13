/** Compact header chip — honest preview label (not Live / Stale / Verified). */
export function PreviewModeChip({
  label = "Preview mode",
}: {
  label?: string;
}) {
  return (
    <span
      data-preview-chip
      className="pf-preview-mode-chip stat-label ct-text-faint"
    >
      {label}
    </span>
  );
}
