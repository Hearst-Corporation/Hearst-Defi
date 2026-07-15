// src/components/admin/chain/dynavault-chain-panel.tsx
//
// The chantier dashboard: which contract the app is pointed at, and everything
// it returns — in BLUE when it comes through the v2 adapter.
//
// Renders ONLY its `<dl>`, with no card chrome of its own, so it composes inside
// `AdminSectionCard` (diagnostics) and `BentoPanel` (vault detail) without
// nesting a panel inside a panel.
//
// Admin-only by construction: both mount points are gated (`requireAdmin` /
// the /admin layout). This is the ONLY surface that renders `Wired.detail` —
// the raw technical diagnostic. Investor surfaces get the closed-vocabulary
// `reason` and nothing more.
//
// ── One read, six rows ───────────────────────────────────────────────────────
// Every row below comes from a SINGLE `readVaultCore()` — one grouped RPC round
// trip instead of six separate ones. `selectWired` / `selectExposed` re-shape
// that one `Wired<VaultCore>` per row while carrying the honesty envelope
// through: on failure all six rows report the SAME reason, which is the truth —
// they all failed for the same reason, at the same instant.

import type { ReactNode } from "react";

import { WiredChip } from "@/components/catalyst/wired-chip";
import { WiredValue } from "@/components/catalyst/wired-value";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import {
  CHAIN_ID,
  LEGACY_SHARE_DECIMALS,
  V2_SHARE_DECIMALS,
  getVaultTarget,
  readVaultCore,
  type VaultCore,
  type VaultMode,
  type Wired,
} from "@/lib/chain/dynavault";
import {
  formatNavPerShare,
  formatShareAmount,
  formatUsdcAmount,
  selectExposed,
  selectWired,
  toWiredLike,
} from "@/lib/chain/wired-view";
import { abbreviateAddress } from "@/lib/onchain";
import { USDC_ADDRESS } from "@/lib/onchain/vault";
import { formatUsdFull } from "@/lib/vaults/product-display";

interface DynavaultChainPanelProps {
  /** When set, the DB aggregate is shown next to the on-chain TVL for compare. */
  dbAumUsdc?: number;
}

const ROW_BASE = "flex items-start justify-between gap-4 px-5 py-4";
const DIVIDER = "border-b border-[var(--ct-border-soft)]";
const DT = "text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]";
const DD = "flex min-w-0 flex-wrap items-center justify-end gap-3 text-right";
const VALUE = "text-[length:var(--ct-text-sm)] font-medium tabular-nums";

const MODE_LABEL: Record<VaultMode, string> = {
  v2: "PermissionedDynaVault v2.1",
  legacy: "HearstYieldVault (ERC-4626)",
  not_configured: "No vault address configured",
};

/**
 * One `Wired<T>` row. `note` explains a support boundary up front (why a value
 * is expected to be missing); `detail` explains an actual failure after the fact.
 */
function ChainRow<T>({
  label,
  note,
  read,
  render,
  last = false,
}: {
  label: string;
  note?: string;
  read: Wired<T>;
  render: (value: T) => ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn(ROW_BASE, !last && DIVIDER)}>
      <dt className="flex min-w-0 flex-col gap-1">
        <span className={DT}>{label}</span>
        {note ? <span className="ct-metric-caption">{note}</span> : null}
        {read.status === "unavailable" && read.detail !== undefined ? (
          <span className="ct-metric-caption text-[var(--ct-text-faint)]">
            {read.detail}
          </span>
        ) : null}
      </dt>
      <dd className={DD}>
        <WiredValue wired={toWiredLike(read)} label={label} render={render} />
      </dd>
    </div>
  );
}

export async function DynavaultChainPanel({
  dbAumUsdc,
}: DynavaultChainPanelProps) {
  const target = getVaultTarget();

  // ONE grouped read — totalAssets / totalShares / navPerShare / asset /
  // tvlCap / paused all arrive together, stamped with one instant.
  const core = await readVaultCore();

  const tvl = selectWired(core, (data) => data.totalAssets);
  const totalShares = selectWired(core, (data) => data.totalShares);
  const nav = selectWired(core, (data) => data.navPerShare);
  const asset = selectWired(core, (data) => data.asset);

  // `tvlCap` and `paused` are `| null` — null is NOT zero and NOT false, it is
  // "this contract has no such view". `selectExposed` turns that into an
  // honest `unavailable` whose reason names the boundary (see wired-view.ts).
  const tvlCap = selectExposed<VaultCore, bigint>(core, (data) => data.tvlCap);
  const paused = selectExposed<VaultCore, boolean>(core, (data) => data.paused);

  // Share unit is MODE-DEPENDENT (v2 = 6, legacy = 18). Read it straight off the
  // envelope the adapter already returned; if the read failed there is no value
  // to format anyway, so fall back to the resolved mode only for the caption.
  const shareDecimals =
    core.status === "wired"
      ? core.data.shareDecimals
      : target.mode === "legacy"
        ? LEGACY_SHARE_DECIMALS
        : V2_SHARE_DECIMALS;

  // Stamp the panel with a real read instant — if the read failed there is no
  // instant to show, and we show none rather than `new Date()`.
  const readAtLabel =
    core.status === "wired" ? `${core.readAt.slice(11, 19)} UTC` : null;

  return (
    <dl className="flex flex-col">
      {/* ── Configuration: what the adapter resolved, before any read ── */}
      <div className={cn(ROW_BASE, DIVIDER)}>
        <dt className={DT}>Adapter mode</dt>
        <dd className={DD}>
          <span className={`${VALUE} text-[var(--ct-text-strong)]`}>
            {MODE_LABEL[target.mode]}
          </span>
          {target.mode === "not_configured" ? (
            <WiredChip state="pending" />
          ) : (
            <WiredChip state="wired" source={target.mode} />
          )}
        </dd>
      </div>

      <div className={cn(ROW_BASE, DIVIDER)}>
        <dt className={DT}>Contract address</dt>
        <dd className={DD}>
          {target.mode === "not_configured" ? (
            <span className={`${VALUE} text-[var(--ct-text-faint)]`}>
              NEXT_PUBLIC_DYNAVAULT_ADDRESS not set
            </span>
          ) : (
            <span className={`${VALUE} break-all text-info`}>
              {target.address}
            </span>
          )}
        </dd>
      </div>

      <div className={cn(ROW_BASE, DIVIDER)}>
        <dt className={DT}>Chain</dt>
        <dd className={DD}>
          <span className={`${VALUE} text-[var(--ct-text-strong)]`}>
            Base Sepolia · {CHAIN_ID}
          </span>
        </dd>
      </div>

      {/* ── Reads ── */}
      <ChainRow
        label="Total assets (TVL)"
        read={tvl}
        render={(raw) => <span className={VALUE}>{formatUsdcAmount(raw)}</span>}
      />

      <ChainRow
        label="Total shares"
        note={
          target.mode === "v2"
            ? `Share unit assumed at ${shareDecimals} decimals (spec "1:1" with USDC) — unconfirmed vs bytecode.`
            : `Share unit ${shareDecimals} decimals — verified on-chain (legacy).`
        }
        read={totalShares}
        render={(raw) => (
          <span className={VALUE}>{formatShareAmount(raw, shareDecimals)}</span>
        )}
      />

      <ChainRow
        label="NAV / share"
        read={nav}
        render={(raw) => <span className={VALUE}>{formatNavPerShare(raw)}</span>}
      />

      <ChainRow
        label="Underlying asset"
        note="Read from the chain, not assumed — a mismatch must be visible."
        read={asset}
        render={(address) => (
          <span className={VALUE} title={address}>
            {abbreviateAddress(address)}
            {address.toLowerCase() === USDC_ADDRESS.toLowerCase()
              ? " · USDC"
              : " · unexpected asset"}
          </span>
        )}
      />

      <ChainRow
        label="TVL cap"
        note="v2 only — the deployed vault has no cap function."
        read={tvlCap}
        render={(raw) => <span className={VALUE}>{formatUsdcAmount(raw)}</span>}
      />

      <ChainRow
        label="Paused"
        note="Legacy Pausable — the v2.1 spec declares no paused()."
        read={paused}
        render={(value) => (
          <span className={VALUE}>{value ? "Yes" : "No"}</span>
        )}
        last={dbAumUsdc === undefined}
      />

      {/* ── The database's own number, when there is one to compare against ── */}
      {dbAumUsdc !== undefined ? (
        <div className={cn(ROW_BASE, "bg-surface-inset")}>
          <dt className="flex min-w-0 flex-col gap-1">
            <span className={DT}>Database aggregate</span>
            <span className="ct-metric-caption">
              Sum of active positions — not a contract read.
            </span>
          </dt>
          <dd className={DD}>
            <span className={`${VALUE} text-[var(--ct-text-strong)]`}>
              {formatUsdFull(dbAumUsdc)}
            </span>
            <ProvenanceBadge kind="estimated" variant="compact" />
          </dd>
        </div>
      ) : null}

      <p className="ct-metric-caption border-t border-[var(--ct-border-soft)] px-5 py-4 leading-relaxed">
        Blue marks a value read through the v2 adapter. A read that did not
        succeed shows its reason and no value — an RPC outage
        (&ldquo;Lecture indisponible&rdquo;) and an absent contract
        function (&ldquo;Rejeté par le contrat&rdquo;) are deliberately distinct.
        {readAtLabel ? ` Last successful read at ${readAtLabel}.` : ""}
      </p>
    </dl>
  );
}
