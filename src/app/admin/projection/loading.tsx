// Grey opaque bento skeleton for the admin projection workspace — header, then
// a controls / projection split. The opaque grey shell masks the ambient halo
// during load.
export default function ProjectionLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading projection"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="h-3 w-32 bg-[#15191C] animate-pulse rounded" />
          <div className="h-7 w-56 bg-[#15191C] animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-[#15191C] animate-pulse rounded" />
        </div>

        {/* CONTROLS / PROJECTION SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">

          {/* CONTROLS */}
          <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="h-5 w-32 bg-[#15191C] animate-pulse rounded" />
            </div>
            <div className="flex flex-col gap-4 p-5">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <div className="h-3 w-24 bg-[#15191C] animate-pulse rounded" />
                  <div className="h-10 w-full bg-[#15191C] animate-pulse rounded-lg" />
                </div>
              ))}
            </div>
          </section>

          {/* PROJECTION */}
          <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 sm:grid-cols-3 border-b border-white/5">
              {[0, 1, 2].map((kpi) => (
                <div
                  key={kpi}
                  className="flex flex-col gap-2 p-5 border-r border-white/5 last:border-r-0"
                >
                  <div className="h-2.5 w-16 bg-[#15191C] animate-pulse rounded" />
                  <div className="h-6 w-24 bg-[#15191C] animate-pulse rounded" />
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="h-64 w-full bg-[#15191C] animate-pulse rounded-xl" />
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
