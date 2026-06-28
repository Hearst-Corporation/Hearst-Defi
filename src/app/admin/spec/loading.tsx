// Grey opaque bento skeleton for the admin spec hub — header, then a grid of
// spec document cards. The opaque grey shell masks the ambient halo during load.
export default function SpecLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading spec"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* SPEC CARD GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <section
              key={card}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm p-5 flex flex-col gap-3"
            >
              <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-5 w-3/4 bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
