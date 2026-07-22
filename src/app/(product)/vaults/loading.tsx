// Zinc skeleton mirroring the Series 1 vault page structure (title → KPI band
// → sectioned panels) so loading→loaded does not flash a different layout.
export default function VaultsLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading Series 1 Vault">
      <div className="flex flex-col gap-3">
        <div className="h-8 w-72 animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
      </div>
      <div className="h-44 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
        <div className="h-56 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
      </div>
    </div>
  );
}
