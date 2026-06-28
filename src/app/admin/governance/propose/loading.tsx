// Grey opaque bento skeleton for the admin governance propose form — header,
// form sections, footer CTA. The opaque grey shell masks the ambient halo during
// load.
export default function GovernanceProposeLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading proposal form"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* FORM SECTION */}
        <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-4 p-5">
            {[0, 1, 2].map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-10 w-full bg-surface-inset animate-pulse rounded-lg" />
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
              <div className="h-24 w-full bg-surface-inset animate-pulse rounded-lg" />
            </div>
          </div>
        </section>

        {/* FOOTER CTA */}
        <div className="flex justify-end gap-3">
          <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
          <div className="h-10 w-32 bg-surface-inset animate-pulse rounded-lg" />
        </div>

      </div>
    </div>
  );
}
