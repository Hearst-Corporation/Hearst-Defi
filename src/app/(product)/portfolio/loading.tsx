/**
 * Portfolio loading — FEUILLE BLANCHE.
 * Neutral skeleton matching the blank rebuild (no portfolio.css, no --ct-*).
 * The previous fused skeleton lives in git (commit 3694bd27).
 */
export default function PortfolioLoading() {
  return (
    <main className="dark min-h-dvh bg-surface-page px-8 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-7 w-40 rounded bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)]" />
        <div className="mt-3 h-4 w-64 rounded bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]" />
        <div className="mt-10 h-64 rounded-xl border border-dashed border-[var(--ct-border)]" />
      </div>
    </main>
  );
}
