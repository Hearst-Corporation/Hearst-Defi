/**
 * DocsignPlaceholder — stub for DocuSign / document upload integration (Phase 2+).
 * Renders a contained placeholder panel. No external network calls.
 */
export function DocsignPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="rounded-lg border border-dashed border-[var(--ct-border)] ct-surface-1 px-6 py-10 text-center"
      role="region"
      aria-label={`${label} placeholder`}
    >
      <p className="text-sm font-medium ct-text-muted">{label}</p>
      <p className="mt-1 text-xs ct-text-dim">
        Document upload / e-signature widget loads here — integration available
        in a later phase.
      </p>
    </div>
  );
}
