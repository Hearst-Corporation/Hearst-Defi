// Grey opaque bento skeleton for the admin vault detail — header, an overview
// band, then editable sections. The opaque grey shell masks the ambient halo
// during load.
export default function VaultDetailLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading vault"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="h-9 w-28 bg-surface-inset animate-pulse rounded-lg" />
            <div className="h-9 w-28 bg-surface-inset animate-pulse rounded-lg" />
          </div>
        </div>

        {/* OVERVIEW BAND */}
        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {[0, 1, 2, 3].map((kpi) => (
            <div key={kpi} className="flex flex-col gap-3 p-5">
              <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-7 w-28 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* EDITABLE SECTIONS */}
        {[0, 1].map((section) => (
          <section
            key={section}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-11/12 bg-surface-inset animate-pulse rounded" />
              <div className="h-24 w-full bg-surface-inset animate-pulse rounded mt-2" />
            </div>
          </section>
        ))}

      </div>
    </div>
  );
}
