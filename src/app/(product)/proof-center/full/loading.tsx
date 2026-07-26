// Grey opaque bento skeleton for the Proof Center full log drill-down — back
// link + title, then the section stack (event log, proofs grid, contracts &
// audit trail, governance timelocks) mirroring ProofCenterFullLogLayout so
// the real content swaps in without a layout shift.
export default function ProofCenterFullLoading() {
  return (
    <div
      className="flex flex-col gap-y-5"
      aria-busy="true"
      aria-label="Loading proof center full log"
    >
      {/* HEADER */}
      <div className="flex flex-col gap-3 pb-3 border-b border-border">
        <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
        <div className="h-3 w-40 bg-surface-inset animate-pulse rounded" />
        <div className="h-8 w-48 bg-surface-inset animate-pulse rounded" />
      </div>

      {/* ON-CHAIN EVENT LOG */}
      <section className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col">
        <div className="flex flex-col gap-1 p-5 border-b border-border-subtle">
          <div className="h-4 w-48 bg-surface-inset animate-pulse rounded" />
          <div className="h-2.5 w-40 bg-surface-inset animate-pulse rounded" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-start gap-3">
              <div className="size-8 shrink-0 bg-surface-inset animate-pulse rounded-md" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="h-3.5 w-1/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
              </div>
              <div className="h-3 w-16 shrink-0 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* OFF-CHAIN PROOFS & DOCUMENTS */}
      <section className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border-subtle">
          <div className="flex flex-col gap-1">
            <div className="h-4 w-56 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-44 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-7 w-28 bg-surface-inset animate-pulse rounded-full shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {[0, 1, 2, 3, 4, 5].map((tile) => (
            <div
              key={tile}
              className="rounded-xl border border-border-subtle bg-surface-inset p-4 flex flex-col gap-3"
            >
              <div className="h-6 w-6 bg-surface-card animate-pulse rounded" />
              <div className="h-3.5 w-4/5 bg-surface-card animate-pulse rounded" />
              <div className="h-2.5 w-2/3 bg-surface-card animate-pulse rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* CONTRACTS & AUDIT TRAIL */}
      {[
        { title: "w-40", subtitle: "w-52" },
        { title: "w-56", subtitle: "w-44" },
        { title: "w-36", subtitle: "w-28" },
      ].map((card, index) => (
        <section
          key={index}
          className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col"
        >
          <div className="flex flex-col gap-1 p-5 border-b border-border-subtle">
            <div className={`h-4 ${card.title} bg-surface-inset animate-pulse rounded`} />
            <div className={`h-2.5 ${card.subtitle} bg-surface-inset animate-pulse rounded`} />
          </div>
          <div className="flex flex-col gap-3 p-5">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <div className="h-3 w-1/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-1/4 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* GOVERNANCE TIMELOCKS */}
      <section className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col">
        <div className="flex flex-col gap-1 p-5 border-b border-border-subtle">
          <div className="h-4 w-64 bg-surface-inset animate-pulse rounded" />
          <div className="h-2.5 w-48 bg-surface-inset animate-pulse rounded" />
        </div>
        <div className="p-5">
          <div className="h-24 w-full bg-surface-inset animate-pulse rounded-xl" />
        </div>
      </section>

      {/* PROVENANCE FOOTER */}
      <div className="h-3 w-2/3 max-w-md bg-surface-inset animate-pulse rounded" />
    </div>
  );
}
