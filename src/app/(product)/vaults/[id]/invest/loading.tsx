// Grey opaque bento skeleton for the invest deposit flow — header + stepper,
// then a form column beside a summary rail. The opaque grey shell masks the
// ambient halo while the flow resolves.
export default function InvestDepositLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading invest flow"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER + STEPPER */}
        <div className="flex flex-col gap-4 pb-3 border-b border-white/10">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-36 bg-[#15191C] animate-pulse rounded" />
            <div className="h-8 w-56 bg-[#15191C] animate-pulse rounded" />
            <div className="h-4 w-full max-w-xl bg-[#15191C] animate-pulse rounded" />
          </div>
          <div className="h-2 w-full max-w-md bg-[#15191C] animate-pulse rounded-full" />
        </div>

        {/* FORM + SUMMARY SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">

          {/* FORM COLUMN */}
          <div className="flex flex-col gap-5">
            {[0, 1].map((card) => (
              <section
                key={card}
                className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
              >
                <div className="p-5 border-b border-white/5">
                  <div className="h-5 w-40 bg-[#15191C] animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-4 p-5">
                  <div className="h-3 w-24 bg-[#15191C] animate-pulse rounded" />
                  <div className="h-12 w-full bg-[#15191C] animate-pulse rounded-lg" />
                  <div className="h-3 w-24 bg-[#15191C] animate-pulse rounded" />
                  <div className="h-12 w-full bg-[#15191C] animate-pulse rounded-lg" />
                </div>
              </section>
            ))}
          </div>

          {/* SUMMARY RAIL */}
          <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="h-5 w-32 bg-[#15191C] animate-pulse rounded" />
            </div>
            <div className="flex flex-col px-5">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between py-3 border-b border-white/5"
                >
                  <div className="h-3 w-24 bg-[#15191C] animate-pulse rounded" />
                  <div className="h-3 w-20 bg-[#15191C] animate-pulse rounded" />
                </div>
              ))}
            </div>
            <div className="p-5 mt-auto">
              <div className="h-12 w-full bg-[#15191C] animate-pulse rounded-lg" />
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
