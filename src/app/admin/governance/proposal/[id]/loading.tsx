// Grey opaque bento skeleton for a single admin governance proposal — header, a
// status band, then a signers / detail panel. The opaque grey shell masks the
// ambient halo during load.
export default function GovernanceProposalLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading proposal"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-[#15191C] animate-pulse rounded" />
            <div className="h-7 w-64 bg-[#15191C] animate-pulse rounded" />
            <div className="h-4 w-full max-w-xl bg-[#15191C] animate-pulse rounded" />
          </div>
          <div className="h-6 w-24 bg-[#15191C] animate-pulse rounded-full shrink-0" />
        </div>

        {/* STATUS BAND */}
        <div className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {[0, 1, 2].map((kpi) => (
            <div key={kpi} className="flex flex-col gap-3 p-5">
              <div className="h-2.5 w-20 bg-[#15191C] animate-pulse rounded" />
              <div className="h-7 w-28 bg-[#15191C] animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* SIGNERS PANEL */}
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="h-5 w-40 bg-[#15191C] animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 shrink-0 bg-[#15191C] animate-pulse rounded-full" />
                  <div className="h-4 w-40 bg-[#15191C] animate-pulse rounded" />
                </div>
                <div className="h-6 w-20 bg-[#15191C] animate-pulse rounded-full shrink-0" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 p-5 border-t border-white/5">
            <div className="h-10 w-24 bg-[#15191C] animate-pulse rounded-lg" />
            <div className="h-10 w-32 bg-[#15191C] animate-pulse rounded-lg" />
          </div>
        </section>

      </div>
    </div>
  );
}
