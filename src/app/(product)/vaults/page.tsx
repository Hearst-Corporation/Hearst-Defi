import { EmptySurface } from "@/components/catalyst/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { listVaults, type VaultProduct } from "@/lib/data/vaults";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { ProductSelectCard } from "@/components/vaults/product-select-card";
import { formatUsdCompact } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Select a Product — Hearst Yield Vault",
};

/**
 * Aggregate capacity/raised across live products only — non-live rows
 * (draft/review/paused/closed) don't take capital, so folding them in would
 * overstate headroom. `currentAumUsdc` is already honest (0 until a real
 * VaultSnapshot exists — see listVaults()), so summing it never fabricates
 * a "raised" figure that isn't backed by the same source the cards show.
 */
function aggregateCapacity(vaults: VaultProduct[]): {
  raisedUsdc: number;
  capacityUsdc: number;
} {
  const live = vaults.filter((v) => v.status === "live");
  return {
    raisedUsdc: live.reduce((sum, v) => sum + v.currentAumUsdc, 0),
    capacityUsdc: live.reduce((sum, v) => sum + v.capacityUsdc, 0),
  };
}

export default async function VaultsPage() {
  const vaults = await listVaults();
  const { raisedUsdc, capacityUsdc } = aggregateCapacity(vaults);
  const hasCapacitySignal = capacityUsdc > 0;

  return (
    <InvestFlowShell
      step="select"
      width="full"
      titleLead="Select a"
      titleAccent="Product"
      contextLabel="Investment Flow"
    >
      {/* Bitcoin Strategic Reserve framing — consultation strip above the
          subscribe catalog. Reuses the existing card-grammar cockpit tokens
          (ct-bento-label / ct-metric-value / surface-card) rather than
          introducing StatBand here, since this page's grammar is card-based,
          not row-based. Every figure keeps its own provenance badge; nothing
          not derivable from listVaults() is invented (RULE #0). */}
      <section
        aria-label="Bitcoin Strategic Reserve — mining production overview"
        className="rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden mb-5"
      >
        <div className="flex flex-col gap-1.5 p-5 pb-4 border-b border-[var(--ct-border-soft)]">
          <span className="ct-bento-label text-[var(--ct-cat-btc)]">
            Bitcoin Strategic Reserve
          </span>
          <p className="ct-metric-caption leading-relaxed max-w-prose">
            Each product below is a Bitcoin mining strategy — capital is deployed
            into hashrate and BTC-correlated positions, with an estimated return
            range rather than a fixed yield.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-1.5 bg-surface-card px-5 py-4">
            <div className="flex items-center gap-1.5">
              <span className="ct-bento-label">Capital raised</span>
              {hasCapacitySignal ? <ProvenanceBadge kind="estimated" variant="compact" /> : null}
            </div>
            {hasCapacitySignal ? (
              <span className="ct-metric-value">{formatUsdCompact(raisedUsdc)}</span>
            ) : (
              <span className="ct-metric-value text-[var(--ct-text-muted)]">—</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 bg-surface-card px-5 py-4">
            <div className="flex items-center gap-1.5">
              <span className="ct-bento-label">Capacity</span>
              {hasCapacitySignal ? <ProvenanceBadge kind="manual" variant="compact" /> : null}
            </div>
            {hasCapacitySignal ? (
              <span className="ct-metric-value">{formatUsdCompact(capacityUsdc)}</span>
            ) : (
              <span className="ct-metric-value text-[var(--ct-text-muted)]">—</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 bg-surface-card px-5 py-4">
            <span className="ct-bento-label">BTC production, per vault</span>
            <span className="body-xs text-[var(--ct-text-faint)] leading-relaxed">
              Per-vault BTC production and reserve reporting — coming next.
            </span>
          </div>
        </div>
      </section>

      <section aria-label="Available products">
        {vaults.length === 0 ? (
          <EmptySurface
            live
            variant="inline"
            message="No vault is currently deployed with a verified on-chain contract."
            detail="Products appear here once a vault is live on Base Sepolia with a confirmed deployment address."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {vaults.map((vault) => (
              <ProductSelectCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </section>
    </InvestFlowShell>
  );
}
