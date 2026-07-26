// Grey opaque bento skeleton for the Customer detail page — back link + email
// title, investor profile grid, positions table, deploy/qualification/agent/
// memory forms, recent conversations, mirroring page.tsx's AdminSectionCard /
// AdminDetailSection stack so the real record swaps in without a layout shift.
export default function CustomerDetailLoading() {
  return (
    <div
      className="flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading investor"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-36 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
            <div className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-8 w-28 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* INVESTOR PROFILE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-40 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-64 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-3.5 w-36 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* VAULT POSITIONS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-36 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="h-3.5 w-1/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* DEPLOY / QUALIFICATION / AGENT / MEMORY forms */}
        {["w-36", "w-44", "w-28", "w-32"].map((width, index) => (
          <section
            key={index}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
              <div className={`h-4 ${width} bg-surface-inset animate-pulse rounded`} />
            </div>
            <div className="p-6">
              <div className="h-24 w-full bg-surface-inset animate-pulse rounded-xl" />
            </div>
          </section>
        ))}

        {/* RECENT CONVERSATIONS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="h-3.5 w-1/2 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-12 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
