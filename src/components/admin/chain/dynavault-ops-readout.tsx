// src/components/admin/chain/dynavault-ops-readout.tsx
//
// The OPERATIONAL half of the v2 readout — everything the new
// PermissionedDynaVault exposes beyond the ERC-4626 core: the strategy pockets
// (B1 Mining / B2 BTC Pouch / B3 Reserve), mining metrics, and the electricity
// account. All in BLUE when it comes through the v2 adapter.
//
// Sibling of DynavaultChainPanel (the ERC-4626 core). Kept separate because
// these reads hit DIFFERENT view functions with different support boundaries:
// in legacy mode the core still reads (totalAssets/NAV), while everything here
// is honestly `unavailable` — the deployed HearstYieldVault has no strategies,
// no mining feed, no electricity account. When v2 is deployed, this whole
// section lights up blue at once.
//
// Admin-only by construction (both mount points are gated). Renders only its
// own sections, no card chrome, so it composes inside AdminSectionCard /
// BentoPanel without nesting a panel in a panel.
//
// Three independent reads (strategies / mining / electricity) rather than one:
// they are separate view calls on-chain, and one may succeed while another
// reverts. Collapsing them would hide a readable block behind an unreadable one.

import type { ReactNode } from "react";

import { WiredChip } from "@/components/catalyst/wired-chip";
import { WiredValue } from "@/components/catalyst/wired-value";
import { cn } from "@/lib/cn";
import {
  getVaultMode,
  readElecStatus,
  readMiningMetrics,
  readStrategies,
  type ElecStatus,
  type MiningMetrics,
  type StrategyInfo,
  type Wired,
} from "@/lib/chain/dynavault";
import {
  formatBps,
  formatBtcFromSats,
  formatHashrateTh,
  formatUsdcAmount,
  selectWired,
  toWiredLike,
} from "@/lib/chain/wired-view";
import { abbreviateAddress } from "@/lib/onchain";

const ROW_BASE = "flex items-start justify-between gap-4 px-5 py-4";
const DIVIDER = "border-b border-[var(--ct-border-soft)]";
const DT = "text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]";
const DD = "flex min-w-0 flex-wrap items-center justify-end gap-3 text-right";
const VALUE = "text-[length:var(--ct-text-sm)] font-medium tabular-nums";
const SECTION_TITLE =
  "px-5 pt-5 pb-2 text-[length:var(--ct-text-xs)] uppercase tracking-wider text-[var(--ct-text-faint)]";

/**
 * Expected Mining Note layout (spec v2.1 §6). Shown as the TARGET next to each
 * pocket's real on-chain allocation, so a divergence between what the contract
 * enforces and what the product promises is visible rather than assumed. Matched
 * by strategy index — the spec fixes this order (B1, B2, B3).
 */
const EXPECTED_POCKETS = [
  { code: "B1", name: "Mining Power", targetBps: 4000n, idle: false },
  { code: "B2", name: "BTC Pouch", targetBps: 2700n, idle: false },
  { code: "B3", name: "Reserve USDC", targetBps: 3300n, idle: true },
] as const;

/** One `Wired<T>` row, identical idiom to DynavaultChainPanel.ChainRow. */
function OpsRow<T>({
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

export async function DynavaultOpsReadout() {
  const mode = getVaultMode();

  // Three independent reads — see file header for why they are not grouped.
  const [strategies, mining, elec] = await Promise.all([
    readStrategies(),
    readMiningMetrics(),
    readElecStatus(),
  ]);

  return (
    <dl className="flex flex-col">
      {/* ── Strategy pockets ─────────────────────────────────────────────── */}
      <div className={cn(SECTION_TITLE, "flex items-center justify-between")}>
        <span>Strategy pockets</span>
        {strategies.status === "wired" ? (
          <WiredChip state="wired" source={strategies.source} />
        ) : mode === "not_configured" ? (
          <WiredChip state="pending" />
        ) : (
          <WiredChip state="unavailable" reason={strategies.reason} />
        )}
      </div>

      {strategies.status === "wired" ? (
        strategies.data.length === 0 ? (
          <OpsRow
            label="Strategies"
            read={strategies}
            render={() => <span className={VALUE}>No strategies configured</span>}
          />
        ) : (
          strategies.data.map((strategy, i) => {
            const expected = EXPECTED_POCKETS[i];
            const allocation = selectWired<StrategyInfo, bigint>(
              { ...strategies, data: strategy },
              (s) => s.allocationBps,
            );
            return (
              <OpsRow
                key={strategy.index}
                label={
                  expected
                    ? `${expected.code} · ${expected.name}`
                    : `Strategy ${strategy.index}`
                }
                note={
                  expected
                    ? `Target ${formatBps(expected.targetBps)}${expected.idle ? " · idle" : ""} · adapter ${abbreviateAddress(strategy.adapter)}`
                    : `adapter ${abbreviateAddress(strategy.adapter)}`
                }
                read={allocation}
                render={(bps) => (
                  <span className={VALUE}>
                    {formatBps(bps)}
                    {strategy.liquid ? " · idle" : ""}
                  </span>
                )}
                last={i === strategies.data.length - 1}
              />
            );
          })
        )
      ) : (
        <OpsRow
          label="Strategies"
          note="v2 only — the deployed vault has no strategies."
          read={strategies}
          render={() => null}
          last
        />
      )}

      {/* ── Mining ───────────────────────────────────────────────────────── */}
      <div className={SECTION_TITLE}>Mining (reported on-chain)</div>

      <OpsRow
        label="Reported hashrate"
        note="Keeper-reported via reportMiningMetrics() — v2 only."
        read={selectWired<MiningMetrics, bigint>(
          mining,
          (m) => m.reportedHashrateTh,
        )}
        render={(th) => <span className={VALUE}>{formatHashrateTh(th)}</span>}
      />

      <OpsRow
        label="BTC earned (cumulative)"
        read={selectWired<MiningMetrics, bigint>(
          mining,
          (m) => m.totalBtcEarnedSats,
        )}
        render={(sats) => <span className={VALUE}>{formatBtcFromSats(sats)}</span>}
        last
      />

      {/* ── Electricity ──────────────────────────────────────────────────── */}
      <div className={SECTION_TITLE}>Electricity account</div>

      <OpsRow
        label="Monthly cost"
        note="v2 only — paid from the B3 reserve pocket."
        read={selectWired<ElecStatus, bigint>(elec, (e) => e.monthlyElecCost)}
        render={(raw) => <span className={VALUE}>{formatUsdcAmount(raw)}</span>}
      />

      <OpsRow
        label="Total paid to date"
        read={selectWired<ElecStatus, bigint>(elec, (e) => e.totalElecPaid)}
        render={(raw) => <span className={VALUE}>{formatUsdcAmount(raw)}</span>}
      />

      <OpsRow
        label="Payee"
        read={selectWired<ElecStatus, string>(elec, (e) => e.elecPayee)}
        render={(address) => (
          <span className={VALUE} title={address}>
            {abbreviateAddress(address)}
          </span>
        )}
      />

      <OpsRow
        label="Paid this month"
        read={selectWired<ElecStatus, boolean>(elec, (e) => e.isPaidThisMonth)}
        render={(paid) => <span className={VALUE}>{paid ? "Yes" : "No"}</span>}
        last
      />

      <p className="ct-metric-caption border-t border-[var(--ct-border-soft)] px-5 py-4 leading-relaxed">
        Blue marks a value read through the v2 adapter. Everything here is
        exclusive to PermissionedDynaVault v2.1 — until it is deployed
        (NEXT_PUBLIC_DYNAVAULT_ADDRESS), the deployed vault exposes none of it and
        each row states so rather than showing a fabricated number. The vending
        curve is omitted: it needs a currentMonth() read the adapter does not yet
        expose.
      </p>
    </dl>
  );
}
