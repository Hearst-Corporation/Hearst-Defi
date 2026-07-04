// Grey opaque bento skeleton for the Outreach console — engagement KPI strip,
// then prospect directory / campaign queue / lead engine tables, mirroring
// page.tsx's AdminSectionCard stack so the real content swaps in without a
// layout shift.
export default function OutreachLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading outreach console"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-10 w-36 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* ENGAGEMENT KPI STRIP */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-44 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
                <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-16 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* PROSPECT DIRECTORY / CAMPAIGN QUEUE / LEAD ENGINE */}
        {[
          { title: "w-44", sub: "w-56", rows: 4 },
          { title: "w-40", sub: "w-52", rows: 3 },
          { title: "w-32", sub: "w-40", rows: 0 },
        ].map((card, index) => (
          <section
            key={index}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1 min-w-0">
                <div className={`h-4 ${card.title} bg-surface-inset animate-pulse rounded`} />
                <div className={`h-2.5 ${card.sub} bg-surface-inset animate-pulse rounded`} />
              </div>
              <div className="h-8 w-24 bg-surface-inset animate-pulse rounded-lg shrink-0" />
            </div>
            {card.rows > 0 ? (
              <div className="flex flex-col">
                {Array.from({ length: card.rows }).map((_, row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between gap-4 px-5 py-3 border-b border-[var(--ct-border-soft)] last:border-b-0"
                  >
                    <div className="h-3 w-1/3 bg-surface-inset animate-pulse rounded" />
                    <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                    <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <div className="h-20 w-full bg-surface-inset animate-pulse rounded-xl" />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
