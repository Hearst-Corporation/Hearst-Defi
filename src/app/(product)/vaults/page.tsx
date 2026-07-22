// /vaults — Series 1 Vault.
//
// The product surface for PermissionedDynaVault v2.1: what the instrument is,
// how capital is structured, and what the contract currently reports. Read
// through the server-only adapter; no write action is offered here — the
// deposit path is described, never executed from this page (no user-write
// endpoint is validated, and the front never touches the contract).

import Link from "next/link";

import {
  getVaultMode,
  readStrategies,
  readVaultCore,
} from "@/lib/chain/dynavault";
import {
  formatBps,
  formatNavPerShare,
  formatShareAmount,
  formatUsdcAmount,
  selectExposed,
  selectWired,
} from "@/lib/chain/wired-view";

import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import {
  Series1Provenance,
  Series1Unavailable,
  Series1WiredRow,
} from "@/components/series1-shell/Series1Wired";
import { Series1Timeline } from "@/components/series1-shell/Series1Timeline";
import { HcCompositionRing } from "@/components/dataviz/his";
import { POCKET_LABELS, POLICY_TARGET_BPS, vaultModeLabel, wiredMetric } from "../dashboard/_view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series 1 Vault · Hearst Bitcoin Reserve Vault",
  description: "BTC-accumulation instrument backed by real Bitcoin mining, delivered at maturity.",
};

export default async function VaultsPage() {
  const [core, strategies] = await Promise.all([readVaultCore(), readStrategies()]);
  const mode = getVaultMode();

  return (
    <Series1Page>
      <Series1PageTitle
        title="Hearst Bitcoin Reserve Vault — Series 1"
        meta={`${vaultModeLabel(mode)} · Methodology v3.0`}
        description="BTC-accumulation instrument backed by real Bitcoin mining, structured across three on-chain pockets and delivered at maturity."
        actions={
          <Link
            href="/proof-center"
            className="inline-flex min-h-10 items-center rounded-lg bg-zinc-800 px-4 text-sm font-medium text-(--ct-accent) ring-1 ring-(--ct-accent)/30 transition-colors hover:bg-zinc-700"
          >
            View proof status
          </Link>
        }
      />

      <Series1KpiBand
        hero={{
          label: "Total assets",
          value: wiredMetric(
            selectWired(core, (c) => c.totalAssets),
            (v) => formatUsdcAmount(v),
          ),
          hint: <Series1Provenance read={core} />,
        }}
        metrics={[
          {
            label: "Total shares",
            value: wiredMetric(
              selectWired(core, (c) => ({ shares: c.totalShares, decimals: c.shareDecimals })),
              (v) => formatShareAmount(v.shares, v.decimals),
            ),
            hint: "Share receipts issued",
          },
          {
            label: "TVL cap",
            // selectExposed: a null cap becomes a proper unavailable envelope
            // (not_exposed_by_contract) instead of a string posing as a value.
            value: wiredMetric(
              selectExposed(core, (c) => c.tvlCap),
              (cap) => formatUsdcAmount(cap),
            ),
            hint: "Maximum capital accepted",
          },
          {
            label: "NAV per share",
            value: wiredMetric(
              selectWired(core, (c) => c.navPerShare),
              (n) => formatNavPerShare(n),
            ),
            hint: "convertToAssets(1 share)",
          },
          { label: "Term", value: "24 months", hint: "BTC delivered at maturity" },
          { label: "Minimum ticket", value: "$250k", hint: "60-day soft lock-up" },
          { label: "Distribution", value: "None", hint: "No periodic cash, no fixed rate" },
        ]}
      />

      <Series1Section
        index="01"
        title="Allocation"
        description="Capital is structured across three on-chain pockets. B1 and B2 are adapter-deployed; B3 is held idle as the operating reserve."
      >
        <Series1Panel>
          <Series1PanelHeader
            title="Policy allocation"
            description={<Series1Provenance read={strategies} />}
          />
          {strategies.status === "wired" ? (
            <Series1RowList>
              {strategies.data.map((s) => {
                const pocket = POCKET_LABELS[s.index];
                return (
                  <Series1Row
                    key={s.index}
                    label={pocket ? `${pocket.id} · ${pocket.label}` : `Strategy ${s.index}`}
                    value={formatBps(s.allocationBps)}
                    hint={`${s.isIdle ? "Idle" : "Adapter-deployed"}${s.enabled ? "" : " · inactive"}`}
                  />
                );
              })}
            </Series1RowList>
          ) : (
            <div className="flex flex-col items-center gap-4 p-6">
              {/* Spec constant (40/27/33) shown as the configured target while
                  the live strategies() read is unavailable — labeled policy,
                  never a measurement. */}
              <HcCompositionRing
                aria-label="Series 1 policy allocation target: B1 40%, B2 27%, B3 33%"
                palette="categorical"
                centerLabel="Policy target"
                centerValue="40 / 27 / 33"
                segments={POLICY_TARGET_BPS.map((bps, i) => ({
                  label: `${POCKET_LABELS[i]?.id ?? `S${i}`} · ${POCKET_LABELS[i]?.label ?? "Strategy"}`,
                  value: bps / 100,
                }))}
              />
              <p className="text-center text-[10px] text-zinc-500 dark:text-zinc-400">
                Configured policy split — not a live allocation.
              </p>
              <Series1Unavailable reason={strategies.reason} detail={strategies.detail} />
            </div>
          )}
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
        title="Reserve construction path"
        description="How mining production converts into the Bitcoin reserve delivered at maturity."
      >
        <Series1Panel>
          <div className="p-5">
            <Series1Timeline
              steps={[
                {
                  label: "Capital deployed",
                  detail: "deposit(assets, receiver) mints share receipts and routes capital across B1 / B2 / B3.",
                },
                {
                  label: "Mining production",
                  detail: "B1 hashrate produces Bitcoin; electricity and operations are funded from B3.",
                },
                {
                  label: "Reserve accumulation",
                  detail: "Produced Bitcoin accumulates in B2. The reserve is built from mining production only.",
                },
                {
                  label: "Delivery at maturity",
                  detail: "The accumulated Bitcoin reserve is delivered in BTC at the end of the term.",
                },
              ]}
            />
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="03" title="Structure">
        <div className="grid gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Smart contract & share receipt" />
            <Series1RowList>
              <Series1Row label="Contract" value={vaultModeLabel(mode)} />
              <Series1WiredRow
                label="Underlying asset"
                read={selectWired(core, (c) => c.asset)}
                render={(a) => `${a.slice(0, 6)}…${a.slice(-4)}`}
                hint="asset() — read from the contract"
              />
              <Series1WiredRow
                label="Share decimals"
                read={selectWired(core, (c) => c.shareDecimals)}
                render={(d) => d.toString()}
                hint="Share receipt precision"
              />
              <Series1Row label="SPV jurisdiction" value="Cayman" />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Maturity & BTC delivery" />
            <Series1RowList>
              <Series1Row label="Term" value="24 months" hint="From subscription settlement" />
              <Series1Row label="Delivered in" value="BTC" hint="Accumulated reserve, at maturity" />
              <Series1Row
                label="Periodic distribution"
                value="None"
                hint="The note pays no periodic cash and carries no fixed rate."
              />
              <Series1Row label="Soft lock-up" value="60 days" hint="Contractual, not enforced on-chain" />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Subscription is arranged off-platform: this surface reports vault state and does not execute contract calls.
        The note carries no fixed rate and no guaranteed return. Estimated outcomes are disclosed as a range and are
        not guaranteed.
      </p>
    </Series1Page>
  );
}
