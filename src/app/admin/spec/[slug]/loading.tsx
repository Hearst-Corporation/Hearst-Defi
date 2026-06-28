// Grey opaque bento skeleton for a single admin spec document — a left nav rail
// beside a prose article. The opaque grey shell masks the ambient halo during
// load.
export default function Loading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading spec document"
    >
      <div className="p-5 lg:p-6 flex gap-5">

        {/* NAV RAIL */}
        <aside className="hidden w-56 shrink-0 flex-col gap-2 lg:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full bg-surface-inset animate-pulse rounded" />
          ))}
        </aside>

        {/* ARTICLE */}
        <article className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5 lg:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
            <div className="h-9 w-2/3 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-11/12 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-4/5 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-6 w-1/3 bg-surface-inset animate-pulse rounded mt-2" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-surface-inset animate-pulse rounded" />
          </div>
        </article>

      </div>
    </div>
  );
}
