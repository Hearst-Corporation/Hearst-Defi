// Grey opaque bento skeleton for Live Diagnostics — overview list plus the 7
// probe sections (flow theater, chat action lab, outreach lifecycle demo,
// technical suites, 3 product diagnostic tables), mirroring page.tsx's
// AdminSectionCard stack so the dry-run probes swap in without a layout shift.
export default function DiagnosticsLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading live diagnostics"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-44 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* OVERVIEW */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-24 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
            ))}
          </div>
        </section>

        {/* 3 interactive labs + technical suites — same tile shape */}
        {[
          { title: "w-40", sub: "w-96" },
          { title: "w-36", sub: "w-full max-w-xl" },
          { title: "w-52", sub: "w-full max-w-xl" },
          { title: "w-36", sub: "w-72" },
        ].map((card, index) => (
          <section
            key={index}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
              <div className={`h-4 ${card.title} bg-surface-inset animate-pulse rounded`} />
              <div className={`h-2.5 ${card.sub} bg-surface-inset animate-pulse rounded`} />
            </div>
            <div className="p-5">
              <div className="h-32 w-full bg-surface-inset animate-pulse rounded-xl" />
            </div>
          </section>
        ))}

        {/* 3 product diagnostic result tables */}
        {[0, 1, 2].map((table) => (
          <section
            key={table}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
              <div className="h-4 w-full max-w-sm bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="divide-y divide-white/5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="h-3.5 w-1/2 bg-surface-inset animate-pulse rounded" />
                  <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
