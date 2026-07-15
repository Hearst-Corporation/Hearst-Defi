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
  readOpsState,
  readStrategies,
  readVendingCurve,
  type ElecStatus,
  type MiningMetrics,
  type OpsState,
  type StrategyInfo,
  type VendingCurvePoint,
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

/** How many vending-curve months to trace, starting at the current month. */
const VENDING_WINDOW = 6;

export async function DynavaultOpsReadout() {
  const mode = getVaultMode();

  // Independent reads — see file header for why they are not grouped. opsState
  // groups the three operational booleans/counters that a readout wants at once.
  const [strategies, mining, elec, ops] = await Promise.all([
    readStrategies(),
    readMiningMetrics(),
    readElecStatus(),
    readOpsState(),
  ]);

  // The Mining Note allocation (40/27/33) is CONTRACTUALLY enforced only when
  // miningNoteMode is on; otherwise the same split is advisory. Default to
  // advisory when the state is unreadable — never claim enforcement we can't see.
  const miningNoteEnforced =
    ops.status === "wired" && ops.data.miningNoteMode === true;
  const pocketBasis = miningNoteEnforced ? "enforced" : "advisory";

  // Trace the vending curve only when currentMonth is actually known — the curve
  // has no meaningful anchor otherwise, and we do not invent one.
  const currentMonth =
    ops.status === "wired" ? Number(ops.data.currentMonth) : null;
  const vendingMonths =
    currentMonth !== null && Number.isFinite(currentMonth)
      ? Array.from({ length: VENDING_WINDOW }, (_unused, i) => currentMonth + i)
      : [];
  const vendingPoints: Wired<VendingCurvePoint>[] = await Promise.all(
    vendingMonths.map((month) => readVendingCurve(month)),
  );

  return (
    <dl className="flex flex-col">
      {/* ── Strategy pockets ─────────────────────────────────────────────── */}
      <div className={cn(SECTION_TITLE, "flex items-center justify-between")}>
        <span>
          Strategy pockets ·{" "}
          {ops.status === "wired"
            ? miningNoteEnforced
              ? "targets enforced"
              : "targets advisory"
            : "basis unknown"}
        </span>
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
                    ? `Target ${formatBps(expected.targetBps)} (${pocketBasis})${expected.idle ? " · idle" : ""} · adapter ${abbreviateAddress(strategy.adapter)}`
                    : `adapter ${abbreviateAddress(strategy.adapter)}`
                }
                read={allocation}
                render={(bps) => (
                  <span className={VALUE}>
                    {formatBps(bps)}
                    {strategy.isIdle ? " · idle" : ""}
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
        label="Ready to pay"
        note="canPay — 30-day cooldown elapsed and idle ≥ monthly cost."
        read={selectWired<ElecStatus, boolean>(elec, (e) => e.canPay)}
        render={(ready) => <span className={VALUE}>{ready ? "Yes" : "No"}</span>}
        last
      />

      {/* ── Operational state ────────────────────────────────────────────── */}
      <div className={SECTION_TITLE}>Operational state</div>

      <OpsRow
        label="Curtailment"
        note="isCurtailed() — mining fleet paused when BTC price crosses the threshold."
        read={selectWired<OpsState, boolean>(ops, (o) => o.isCurtailed)}
        render={(curtailed) => (
          <span className={VALUE}>{curtailed ? "Curtailed" : "Active"}</span>
        )}
      />

      <OpsRow
        label="Current month"
        note="currentMonth() — product month the monthly engine has advanced to."
        read={selectWired<OpsState, bigint>(ops, (o) => o.currentMonth)}
        render={(month) => (
          <span className={VALUE}>{month.toString()}</span>
        )}
      />

      <OpsRow
        label="Mining Note mode"
        note="miningNoteMode() — on ⇒ the 40/27/33 split is contractually enforced; off ⇒ advisory."
        read={selectWired<OpsState, boolean>(ops, (o) => o.miningNoteMode)}
        render={(on) => (
          <span className={VALUE}>{on ? "Enforced" : "Advisory"}</span>
        )}
        last
      />

      {/* ── Vending curve ────────────────────────────────────────────────── */}
      <div className={SECTION_TITLE}>
        Vending curve
        {currentMonth !== null ? ` (from month ${currentMonth})` : ""}
      </div>

      {currentMonth === null ? (
        // currentMonth is null iff ops is unavailable (Number(bigint) is never
        // null), so ops carries the real reason the curve cannot be anchored.
        // Project to a never-rendered field so the row just shows the reason.
        <OpsRow
          label="Vending curve"
          note="vendingCurveBps(month) — traced once currentMonth() is readable."
          read={selectWired<OpsState, null>(ops, () => null)}
          render={() => null}
          last
        />
      ) : (
        vendingPoints.map((point, i) => (
          <OpsRow
            key={vendingMonths[i]}
            label={`Month ${vendingMonths[i]}`}
            read={selectWired<VendingCurvePoint, bigint>(point, (p) => p.bps)}
            render={(bps) => <span className={VALUE}>{formatBps(bps)}</span>}
            last={i === vendingPoints.length - 1}
          />
        ))
      )}

      <p className="ct-metric-caption border-t border-[var(--ct-border-soft)] px-5 py-4 leading-relaxed">
        Blue marks a value read through the v2 adapter. Everything here is
        exclusive to PermissionedDynaVault v2.1 — until it is deployed
        (NEXT_PUBLIC_DYNAVAULT_ADDRESS), the deployed vault exposes none of it and
        each row states so rather than showing a fabricated number. The vending
        curve is anchored on the on-chain currentMonth() read; without it, no
        month window is drawn rather than an invented one.
      </p>
    </dl>
  );
}
