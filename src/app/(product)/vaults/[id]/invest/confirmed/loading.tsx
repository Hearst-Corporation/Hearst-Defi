// Grey opaque bento skeleton for the deposit confirmation page — narrow
// column mirroring the real shell (header + stepper, hero, position details,
// next steps, actions). The opaque grey shell masks the ambient halo while
// the on-chain NAV read + position lookup resolve.
export default function InvestConfirmedLoading() {
  return (
    <div
      className="dark mx-auto flex w-full max-w-2xl flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page p-5 lg:p-6 mb-8"
      aria-busy="true"
      aria-label="Loading deposit confirmation"
    >
      <div className="flex flex-col gap-y-5">

        {/* HEADER + STEPPER */}
        <div className="flex flex-col gap-4 pb-5 border-b border-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-8 w-52 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-full max-w-xs bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-2 w-full max-w-md bg-surface-inset animate-pulse rounded-full" />
        </div>

        {/* CONFIRMATION HERO */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col items-center text-center p-8">
          <div className="size-12 rounded-full bg-surface-inset animate-pulse" />
          <div className="mt-5 h-3 w-32 bg-surface-inset animate-pulse rounded-full" />
          <div className="mt-3 h-7 w-56 bg-surface-inset animate-pulse rounded" />
          <div className="mt-3 h-4 w-full max-w-md bg-surface-inset animate-pulse rounded" />
        </section>

        {/* POSITION DETAILS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-2">
              <div className="h-3.5 w-32 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-40 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>

          <div className="flex flex-col">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]"
              >
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-3.5 w-28 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}

            {/* Soft-lock progress row */}
            <div className="flex flex-col gap-3 px-5 py-4 border-b border-[var(--ct-border-soft)] bg-surface-inset">
              <div className="flex items-center justify-between gap-4">
                <div className="h-2.5 w-16 bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-40 bg-surface-card animate-pulse rounded" />
              </div>
              <div className="h-2 w-full rounded-full bg-surface-card animate-pulse" />
            </div>

            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
              <div className="h-3.5 w-24 bg-surface-inset animate-pulse rounded" />
            </div>
          </div>
        </section>

        {/* NEXT STEPS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3.5 w-24 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ct-border-soft)] last:border-b-0"
              >
                <div className="size-1.5 rounded-full bg-surface-inset animate-pulse shrink-0" />
                <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* ACTIONS */}
        <div className="flex flex-col gap-3">
          <div className="h-11 w-full bg-surface-inset animate-pulse rounded-lg" />
          <div className="h-11 w-full bg-surface-inset animate-pulse rounded-lg" />
        </div>

      </div>
    </div>
  );
}
