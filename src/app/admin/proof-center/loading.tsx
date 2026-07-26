// Grey opaque bento skeleton for the admin proof center — a header band plus a
// 2x2 grid of proof panels. The opaque grey shell masks the ambient halo while
// the real data resolves.
export default function ProofCenterLoading() {
  return (
    <div
      className="flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading proof center"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-end justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-36 bg-surface-inset animate-pulse rounded" />
            <div className="h-8 w-48 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-full max-w-2xl bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-8 w-32 bg-surface-inset animate-pulse rounded-full shrink-0" />
        </div>

        {/* PANEL GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((panel) => (
            <section
              key={panel}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
              <div className="flex flex-col gap-4 p-5">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-start gap-3">
                    <div className="size-8 shrink-0 bg-surface-inset animate-pulse rounded-md" />
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <div className="h-3.5 w-1/3 bg-surface-inset animate-pulse rounded" />
                      <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
                      <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
