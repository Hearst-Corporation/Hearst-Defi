// /dashboard — Overview.
//
// Server Component reading the vault through the ONE server-only passage point
// (`src/lib/chain/dynavault.ts`). No client fetch, no viem in this tree, no
// second data layer: the adapter's `Wired<T>` envelopes reach the Series 1
// primitives intact, so an RPC outage never renders as "no data" and an
// undeployed contract never renders as a zero (docs/frontend-api-only-policy.md).
//
// Today `NEXT_PUBLIC_DYNAVAULT_ADDRESS` is unset, so most reads resolve
// `unavailable` with a motive — that IS the honest state of the product, and it
// is what the page shows.

import {
  getVaultMode,
  readElecStatus,
  readMiningMetrics,
  readOpsState,
  readProductDurationMonths,
  readStrategies,
  readVaultCore,
} from "@/lib/chain/dynavault";
import {
  formatBps,
  formatBtcFromSats,
  formatHashrateTh,
  formatNavPerShare,
  formatShareAmount,
  formatUsdcAmount,
  selectWired,
} from "@/lib/chain/wired-view";

import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import {
  reasonLabel,
  Series1Provenance,
  Series1WiredRow,
} from "@/components/series1-shell/Series1Wired";
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";
import { HcCompositionRing } from "@/components/dataviz/his";
import { placeholderStatus, POCKET_LABELS, POLICY_TARGET_BPS, vaultModeLabel, wiredMetric } from "./_view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function DashboardPage() {
  // One batch per concern; each returns its own envelope so a failing read
  // never drags a succeeding one down with it.
  const [core, strategies, mining, elec, ops, duration] = await Promise.all([
    readVaultCore(),
    readStrategies(),
    readMiningMetrics(),
    readElecStatus(),
    readOpsState(),
    readProductDurationMonths(),
  ]);

  const mode = getVaultMode();
  const totalAssets = selectWired(core, (c) => c.totalAssets);

  return (
    <Series1Page>
      <Series1PageTitle
        title="Reserve Vault Overview"
        meta={`${vaultModeLabel(mode)} · Methodology v3.0`}
        description="A single investor register for capital deployment, accumulated Bitcoin, reserve coverage, mining operations and proof readiness."
      />

      <Series1KpiBand
        hero={{
          label: "Total assets",
          value: wiredMetric(totalAssets, (v) => formatUsdcAmount(v)),
          hint: <Series1Provenance read={core} />,
        }}
        metrics={[
          {
            label: "Total shares",
            // One envelope carries value + its own decimals, so the formatter
            // can never pair a wired value with a guessed precision.
            value: wiredMetric(
              selectWired(core, (c) => ({ shares: c.totalShares, decimals: c.shareDecimals })),
              (v) => formatShareAmount(v.shares, v.decimals),
            ),
            hint: "Shares in circulation",
          },
          {
            label: "Term progress",
            value: wiredMetric(
              selectWired(ops, (o) => o.currentMonth),
              (m) => `${m.toString()}${duration.status === "wired" ? ` / ${duration.data.months.toString()}` : ""}`,
            ),
            hint: "Months elapsed",
          },
          {
            label: "Mining state",
            value: wiredMetric(
              selectWired(ops, (o) => o.isCurtailed),
              (c) => (c ? "Curtailed" : "Active"),
            ),
            hint: "Current reporting window",
          },
          {
            label: "Hashrate",
            value: wiredMetric(
              selectWired(mining, (m) => m.reportedHashrateTh),
              (h) => formatHashrateTh(h),
            ),
            hint: "Last reported on-chain",
          },
          {
            label: "BTC earned",
            value: wiredMetric(
              selectWired(mining, (m) => m.totalBtcEarnedSats),
              (s) => formatBtcFromSats(s),
            ),
            hint: "Cumulative, delivered at maturity",
          },
          {
            label: "Electricity",
            value: wiredMetric(
              selectWired(elec, (e) => e.canPay),
              (c) => (c ? "Payable" : "On cooldown"),
            ),
            hint: "B3 Reserve funding",
          },
        ]}
      />

      <Series1Section
        index="01"
        title="Bitcoin accumulation"
        description="Accumulated BTC is the principal investor outcome. Market price is contextual only; it is not a return projection."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1ChartPlaceholder
            className="lg:col-span-8"
            title="Accumulated BTC through the term"
            description="Mining credits indexed from the program ledger."
            // Never "live": this surface renders placeholder copy, not a
            // series — a wired mining read earns "Placeholder", not a Live
            // pill over a panel that still displays no measured data.
            status={mining.status === "wired" ? "mock" : placeholderStatus(mining)}
            label="Accumulation history is not available yet"
            detail="The contract reports a cumulative total, not a per-month series. A curve appears once the ledger indexes monthly credits."
          />
          <Series1Panel className="lg:col-span-4">
            <Series1PanelHeader title="Mining register" />
            <Series1RowList>
              <Series1WiredRow
                label="Reported hashrate"
                read={selectWired(mining, (m) => m.reportedHashrateTh)}
                render={(h) => formatHashrateTh(h)}
                hint="reportMiningMetrics()"
              />
              <Series1WiredRow
                label="BTC earned"
                read={selectWired(mining, (m) => m.totalBtcEarnedSats)}
                render={(s) => formatBtcFromSats(s)}
                hint="Cumulative on-chain"
              />
              <Series1WiredRow
                label="Last report"
                read={selectWired(mining, (m) => m.lastReportTime)}
                render={(t) =>
                  t > 0n ? new Date(Number(t) * 1000).toISOString().slice(0, 10) : "Never reported"
                }
                hint="Keeper operation"
              />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Capital architecture"
        description="Capital is governed by the Series 1 policy allocation: B1 Mining Power, B2 BTC Reserve and B3 Operating Reserve."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Series1Panel className="lg:col-span-7">
            <Series1PanelHeader
              title="Policy allocation"
              description={<Series1Provenance read={strategies} />}
            />
            {strategies.status === "wired" ? (
              <div className="flex flex-col gap-5 p-5">
                {strategies.data.map((s) => {
                  const pct = Number(s.allocationBps) / 100;
                  const pocket = POCKET_LABELS[s.index];
                  return (
                    <div key={s.index}>
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {pocket ? `${pocket.id} · ${pocket.label}` : `Strategy ${s.index}`}
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            {s.isIdle ? "Idle — held as vault balance" : "Adapter-deployed"}
                            {s.enabled ? "" : " · inactive"}
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-semibold text-zinc-950 tabular-nums dark:text-white">
                          {formatBps(s.allocationBps)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
                        {/* Accent fills the bar because the bar IS the datum. */}
                        <div
                          className="h-full rounded-full bg-[#a7fb90]"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-5 p-6">
                {/* The POLICY target is a spec constant (40/27/33), honestly
                    renderable while the live strategies() read is unavailable —
                    labeled as the configured target, never as a measurement.
                    `bars` fills the panel width with one gauge per pocket. */}
                <HcCompositionRing
                  aria-label="Series 1 policy allocation target: B1 40%, B2 27%, B3 33%"
                  palette="categorical"
                  size={190}
                  bars
                  centerLabel="Policy target"
                  centerValue="40/27/33"
                  segments={POLICY_TARGET_BPS.map((bps, i) => ({
                    label: `${POCKET_LABELS[i]?.id ?? `S${i}`} · ${POCKET_LABELS[i]?.label ?? "Strategy"}`,
                    value: bps / 100,
                  }))}
                />
                {/* Investor copy — the adapter's raw detail (env vars, deploy
                    steps) stays off this surface. */}
                <p className="border-t border-zinc-950/5 pt-4 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  Configured policy split — not a live allocation. {reasonLabel(strategies.reason)}: the measured
                  pocket allocation appears once the v2.1 contract is deployed.
                </p>
              </div>
            )}
          </Series1Panel>
          <Series1Panel className="lg:col-span-5">
            <Series1PanelHeader title="Capital flow" />
            <div className="p-5">
              <Series1Timeline
                steps={[
                  { label: "USDC subscription", detail: "deposit(assets, receiver) mints shares." },
                  { label: "B1 / B2 / B3 allocation", detail: "Assets route to the policy split on deposit." },
                  { label: "BTC reserve ledger", detail: "Mining production credits the reserve." },
                  { label: "BTC delivery at maturity", detail: "The accumulated reserve is delivered in BTC." },
                ]}
              />
            </div>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="03"
        title="Operations, reserve & proof"
        description="Operational reports are kept separate from the investor outcome so every number retains its source and meaning."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader
              title="Electricity & reserve"
              description={<Series1Provenance read={elec} />}
            />
            <Series1RowList>
              <Series1WiredRow
                label="Monthly cost"
                read={selectWired(elec, (e) => e.monthlyElecCost)}
                render={(c) => formatUsdcAmount(c)}
                hint="Funded from B3"
              />
              <Series1WiredRow
                label="Total paid"
                read={selectWired(elec, (e) => e.totalElecPaid)}
                render={(t) => formatUsdcAmount(t)}
                hint="Since inception"
              />
              <Series1WiredRow
                label="Last payment"
                read={selectWired(elec, (e) => e.lastElecPaymentTime)}
                render={(t) => (t > 0n ? new Date(Number(t) * 1000).toISOString().slice(0, 10) : "Never paid")}
              />
              <Series1WiredRow
                label="Payable now"
                read={selectWired(elec, (e) => e.canPay)}
                render={(c) => (c ? "Yes" : "No")}
                hint="30-day cooldown + idle balance"
              />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Vault & contract status" />
            <Series1RowList>
              <Series1Row label="Vault mode" value={vaultModeLabel(mode)} />
              <Series1WiredRow
                label="NAV per share"
                read={selectWired(core, (c) => c.navPerShare)}
                render={(v) => formatNavPerShare(v)}
                hint="convertToAssets(1 share)"
              />
              <Series1WiredRow
                label="Contract state"
                read={selectWired(core, (c) => c.paused)}
                render={(p) => (p ? "Paused" : "Active")}
                hint="paused() — Pausable read"
              />
              <Series1WiredRow
                label="Mining Note mode"
                read={selectWired(ops, (o) => o.miningNoteMode)}
                render={(m) => (m ? "Enforced" : "Advisory")}
                hint="40 / 27 / 33 policy split"
              />
              <Series1WiredRow
                label="Underlying asset"
                read={selectWired(core, (c) => c.asset)}
                render={(a) => `${a.slice(0, 6)}…${a.slice(-4)}`}
                hint="Read from the contract"
              />
              <Series1Row label="Delivery evidence" value="At maturity" hint="Contractual term, not a chain read" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Accumulated BTC is delivered at maturity. Allocation, reserve and mining figures carry their own provenance;
        estimates and forward-looking outcomes are not guaranteed.
      </p>
    </Series1Page>
  );
}
