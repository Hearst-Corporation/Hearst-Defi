// Grey opaque bento skeleton for the admin roadmap — header + actions, then a
// table band. The opaque grey shell masks the ambient halo during load.
export default function RoadmapLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading roadmap"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-[#15191C] animate-pulse rounded" />
            <div className="h-7 w-48 bg-[#15191C] animate-pulse rounded" />
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="h-9 w-28 bg-[#15191C] animate-pulse rounded-lg" />
            <div className="h-9 w-28 bg-[#15191C] animate-pulse rounded-lg" />
          </div>
        </div>

        {/* TABLE */}
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="h-8 w-full bg-[#15191C] animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="h-4 w-2/3 bg-[#15191C] animate-pulse rounded" />
                <div className="h-4 w-20 bg-[#15191C] animate-pulse rounded shrink-0" />
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
