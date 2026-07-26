// Grey opaque bento skeleton for the admin governance console — header + action,
// then a stack of proposal cards. The opaque grey shell masks the ambient halo
// during load.
export default function GovernanceLoading() {
  return (
    <div
      className="flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading governance"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-10 w-40 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* PROPOSAL CARDS */}
        <div className="flex flex-col gap-5">
          {[0, 1, 2].map((card) => (
            <section
              key={card}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-5 w-1/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
              <div className="h-24 w-full bg-surface-inset animate-pulse rounded" />
              <div className="flex gap-3">
                <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
                <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
