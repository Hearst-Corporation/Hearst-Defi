// Grey opaque bento skeleton for the Data Sources control surface — ingestion
// bricks grid, machine prices table, APY range per vault, mirroring page.tsx's
// 3 AdminSectionCard blocks so the real live ingestion data swaps in without a
// layout shift.
export default function SourceLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading data sources"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-40 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* DATA PIPELINE (4 bricks) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-56 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
            {[0, 1, 2, 3].map((brick) => (
              <div
                key={brick}
                className="rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset p-4 flex flex-col gap-2"
              >
                <div className="h-3.5 w-1/2 bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-full bg-surface-card animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* MACHINE PRICES */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-56 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-72 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div className="h-14 w-full bg-surface-inset animate-pulse rounded-xl" />
            <div className="h-9 w-64 bg-surface-inset animate-pulse rounded-lg" />
            <div className="rounded-xl border border-[var(--ct-border-soft)] overflow-hidden">
              <div className="divide-y divide-white/5">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="h-3.5 w-32 bg-surface-inset animate-pulse rounded" />
                    <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                    <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* APY RANGE PER VAULT */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-44 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-72 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {[0, 1, 2].map((v) => (
              <div
                key={v}
                className="rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset p-4 flex flex-col gap-2"
              >
                <div className="h-3.5 w-2/3 bg-surface-card animate-pulse rounded" />
                <div className="h-5 w-24 bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-full bg-surface-card animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
