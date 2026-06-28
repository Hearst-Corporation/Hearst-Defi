// Grey opaque bento skeleton for the admin new-vault form — header, then a
// stack of form sections with a footer CTA. The opaque grey shell masks the
// ambient halo during load.
export default function NewVaultLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading new vault form"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* FORM SECTIONS */}
        {[0, 1].map((section) => (
          <section
            key={section}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-10 w-full bg-surface-inset animate-pulse rounded-lg" />
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* FOOTER CTA */}
        <div className="flex justify-end gap-3">
          <div className="h-10 w-24 bg-surface-inset animate-pulse rounded-lg" />
          <div className="h-10 w-32 bg-surface-inset animate-pulse rounded-lg" />
        </div>

      </div>
    </div>
  );
}
