// Grey opaque bento skeleton for the admin feedback console — header, a submit
// form panel, then a list of recent feedback. The opaque grey shell masks the
// ambient halo during load.
export default function FeedbackLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading feedback"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="h-3 w-24 bg-[#15191C] animate-pulse rounded" />
          <div className="h-7 w-48 bg-[#15191C] animate-pulse rounded" />
          <div className="h-4 w-72 bg-[#15191C] animate-pulse rounded" />
        </div>

        {/* FORM PANEL */}
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm p-5 flex flex-col gap-4">
          <div className="h-5 w-1/3 bg-[#15191C] animate-pulse rounded" />
          <div className="h-24 w-full bg-[#15191C] animate-pulse rounded" />
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-[#15191C] animate-pulse rounded-lg" />
            <div className="h-10 w-24 bg-[#15191C] animate-pulse rounded-lg" />
          </div>
        </section>

        {/* RECENT LIST */}
        <div className="flex flex-col gap-3">
          <div className="h-3 w-32 bg-[#15191C] animate-pulse rounded" />
          {[0, 1, 2, 3].map((card) => (
            <section
              key={card}
              className="rounded-2xl border border-white/10 bg-black shadow-sm p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-40 bg-[#15191C] animate-pulse rounded" />
                <div className="h-5 w-16 bg-[#15191C] animate-pulse rounded-full shrink-0" />
              </div>
              <div className="h-3 w-full bg-[#15191C] animate-pulse rounded" />
              <div className="h-3 w-2/3 bg-[#15191C] animate-pulse rounded" />
            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
