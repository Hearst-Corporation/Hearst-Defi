// src/components/vaults/vault-chain-readout.tsx
//
// The investor-facing "On-chain State" panel: what the vault contract actually
// returns, right now, in BLUE — with the database's own aggregate on the line
// below it.
//
// Putting both in ONE block is the whole point. The snapshot aggregate and the
// chain do not agree today, and the gap is the information: it is the difference
// between what the product claims and what is settled on-chain. Neither number
// is hidden and neither is presented as the other.
//
// Async Server Component: it awaits the adapter directly. No client fetch, no
// useEffect, no loading state to fake. TVL and NAV come from a SINGLE grouped
// `readVaultCore()` — one round trip, one read instant, one verdict.

import { BentoHeader } from "@/components/catalyst/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { WiredChip } from "@/components/catalyst/wired-chip";
import { WiredValue } from "@/components/catalyst/wired-value";
import { CHAIN_ID, getVaultTarget, readVaultCore } from "@/lib/chain/dynavault";
import {
  formatNavPerShare,
  formatUsdcAmount,
  selectWired,
  toWiredLike,
} from "@/lib/chain/wired-view";
import { AUM_PENDING_LABEL } from "@/lib/constants/vault";
import { abbreviateAddress } from "@/lib/onchain";
import { formatUsdCompact } from "@/lib/vaults/product-display";

interface VaultChainReadoutProps {
  /** The snapshot aggregate the rest of the page shows — for side-by-side
   *  compare. `null` = no snapshot attributes an AUM to this vault, which is
   *  not the same as a measured zero. */
  dbAumUsdc: number | null;
}

const ROW =
  "flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]";
const ROW_LAST = "flex items-center justify-between gap-4 px-5 py-4";
const DT = "text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]";
const DD = "flex min-w-0 items-center gap-3";
const VALUE = "text-[length:var(--ct-text-sm)] font-medium tabular-nums";

export async function VaultChainReadout({ dbAumUsdc }: VaultChainReadoutProps) {
  const target = getVaultTarget();
  const core = await readVaultCore();

  const tvl = selectWired(core, (data) => data.totalAssets);
  const nav = selectWired(core, (data) => data.navPerShare);

  // The header chip reports the READ, not the config: claiming "wired" while the
  // RPC is down would be exactly the lie this panel exists to prevent.
  const headerChip =
    core.status === "wired" ? (
      <WiredChip state="wired" source={core.source} />
    ) : target.mode === "not_configured" ? (
      <WiredChip state="pending" />
    ) : (
      <WiredChip state="unavailable" reason={core.reason} />
    );

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)]">
      <BentoHeader
        title="On-chain State"
        subtitle={`Read from the vault contract · Base Sepolia · chain ${CHAIN_ID}`}
        trailing={headerChip}
      />

      <dl className="flex flex-col">
        {/* Vault contract — which address the app is pointed at. */}
        <div className={ROW}>
          <dt className={DT}>Vault contract</dt>
          <dd className={DD}>
            {target.mode === "not_configured" ? (
              <span
                className={`${VALUE} text-[var(--ct-text-faint)]`}
              >
                Not configured
              </span>
            ) : (
              <>
                <span
                  className={`${VALUE} truncate text-info`}
                  title={target.address}
                >
                  {abbreviateAddress(target.address)}
                </span>
                <WiredChip state="wired" source={target.mode} />
              </>
            )}
          </dd>
        </div>

        {/* TVL — the real capital settled in the contract. */}
        <div className={ROW}>
          <dt className={DT}>TVL (on-chain)</dt>
          <dd className={DD}>
            <WiredValue
              wired={toWiredLike(tvl)}
              label="TVL on-chain"
              render={(raw) => (
                <span className={VALUE}>{formatUsdcAmount(raw)}</span>
              )}
            />
          </dd>
        </div>

        {/* NAV per share. */}
        <div className={ROW}>
          <dt className={DT}>NAV / share</dt>
          <dd className={DD}>
            <WiredValue
              wired={toWiredLike(nav)}
              label="NAV per share"
              render={(raw) => (
                <span className={VALUE}>{formatNavPerShare(raw)}</span>
              )}
            />
          </dd>
        </div>

        {/* The database's own number, kept side by side — never overwritten. */}
        <div className={`${ROW_LAST} bg-surface-inset`}>
          <dt className="flex min-w-0 flex-col gap-1">
            <span className={DT}>Snapshot aggregate (database)</span>
            <span className="ct-metric-caption">
              Computed off-chain — not a contract read.
            </span>
          </dt>
          <dd className={DD}>
            <span className={`${VALUE} text-[var(--ct-text-strong)]`}>
              {dbAumUsdc !== null && dbAumUsdc > 0
                ? formatUsdCompact(dbAumUsdc)
                : AUM_PENDING_LABEL}
            </span>
            <ProvenanceBadge kind="estimated" variant="compact" />
          </dd>
        </div>
      </dl>
    </section>
  );
}
