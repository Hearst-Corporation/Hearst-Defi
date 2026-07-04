// Grey opaque bento skeleton for the Investor Report Preview — report source
// banner + readiness, then the interactive report surface, mirroring
// page.tsx's AdminSectionCard + ProjectionReportPreview so the real study run
// swaps in without a layout shift.
export default function ProjectionPreviewLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading investor report preview"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-48 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-40 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* REPORT SOURCE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-64 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div className="h-14 w-full bg-surface-inset animate-pulse rounded-xl" />
            <div className="h-24 w-full bg-surface-inset animate-pulse rounded-xl" />
          </div>
        </section>

        {/* INTERACTIVE REPORT PREVIEW */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5">
            <div className="h-96 w-full bg-surface-inset animate-pulse rounded-xl" />
          </div>
        </section>
      </div>
    </div>
  );
}
