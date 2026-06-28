// Grey opaque bento skeleton for the admin investor memo — header, then a long
// prose document panel. The opaque grey shell masks the ambient halo during
// load.
export default function InvestorMemoLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading investor memo"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-9 w-28 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* DOCUMENT PANEL */}
        <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5 lg:p-6 flex flex-col gap-5">
          <div className="h-9 w-2/3 bg-surface-inset animate-pulse rounded" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-11/12 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-4/5 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-6 w-1/3 bg-surface-inset animate-pulse rounded mt-2" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-surface-inset animate-pulse rounded" />
          </div>
        </section>

      </div>
    </div>
  );
}
