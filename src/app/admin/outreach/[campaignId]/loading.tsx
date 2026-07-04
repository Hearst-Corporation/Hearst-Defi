// Grey opaque bento skeleton for the Campaign detail page — back link +
// campaign name, brief grid, draft/release actions, recipient review queue,
// mirroring page.tsx's AdminSectionCard stack so the real campaign record
// swaps in without a layout shift.
export default function CampaignDetailLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading campaign"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-28 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-52 bg-surface-inset animate-pulse rounded" />
            <div className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
        </div>

        {/* CAMPAIGN BRIEF */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-64 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-3.5 w-40 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* DRAFT GENERATION */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-36 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="h-3 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
            <div className="h-9 w-36 bg-surface-inset animate-pulse rounded-lg" />
          </div>
        </section>

        {/* RECIPIENT REVIEW QUEUE */}
        <div className="flex flex-col gap-4">
          <div className="h-4 w-56 bg-surface-inset animate-pulse rounded" />
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-3.5 w-1/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full" />
              </div>
              <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-4/5 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
