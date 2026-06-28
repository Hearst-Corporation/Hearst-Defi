// Grey opaque bento skeleton for the admin product workspace — header, an input
// band, a brief split, then a card grid. The opaque grey shell masks the ambient
// halo during load.
export default function ProductWorkspaceLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading product workspace"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="h-3 w-40 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-64 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-2xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* INPUT BAND */}
        <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5 flex flex-col gap-3">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-10 w-full max-w-xl bg-surface-inset animate-pulse rounded-lg" />
        </section>

        {/* BRIEF SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1].map((card) => (
            <section
              key={card}
              className="rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5 flex flex-col gap-4"
            >
              <div className="h-5 w-1/3 bg-surface-inset animate-pulse rounded" />
              <div className="h-24 w-full bg-surface-inset animate-pulse rounded" />
              <div className="flex gap-3">
                <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
                <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
              </div>
            </section>
          ))}
        </div>

        {/* CARD GRID */}
        <div className="flex flex-col gap-3">
          <div className="h-6 w-48 bg-surface-inset animate-pulse rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((card) => (
              <section
                key={card}
                className="rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5 flex flex-col gap-4"
              >
                <div className="h-5 w-1/2 bg-surface-inset animate-pulse rounded" />
                <div className="h-24 w-full bg-surface-inset animate-pulse rounded" />
                <div className="flex gap-3">
                  <div className="h-10 w-20 bg-surface-inset animate-pulse rounded-lg" />
                  <div className="h-10 w-20 bg-surface-inset animate-pulse rounded-lg" />
                </div>
              </section>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
