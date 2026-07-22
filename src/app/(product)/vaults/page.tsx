// /vaults — Series 1 Vault.
//
// The product surface for PermissionedDynaVault v2.1: what the instrument is,
// how capital is structured, and what the contract currently reports.
//
// Read through hearst-connect-backend (independent repository) over HTTP — see
// ./_data/vault-loader.ts. This page does NOT import
// `src/lib/chain/dynavault.ts`: the frontend no longer reads business facts
// from the chain itself, so there is exactly one source for totalAssets /
// navPerShare / the B1-B2-B3 pockets, and it is the backend. (The adapter
// stays in the tree for the client-side wallet-signing deposit/redeem flows.)
//
// No write action is offered here — the deposit path is described, never
// executed from this page.

import Link from "next/link";

import { investProductPath } from "@/lib/vaults/invest-routes";

import {
  formatBps,
  formatNavPerShare,
  formatShareAmount,
  formatUsdcAmount,
} from "@/lib/chain/wired-view";
import { selectExposedFromWired, selectFromWired, vaultModeLabel } from "@/lib/backend/resolved-view";

import { loadVaultPageData } from "./_data/vault-loader";

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
// `vaultModeLabel` comes from the backend view helper, not `_view`: the mode
// now reflects what the BACKEND says answered (including "v2-fork"), not the
// frontend's own env-derived VaultMode.
import { POCKET_LABELS, POLICY_TARGET_BPS, wiredMetric } from "../dashboard/_view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series 1 Vault · Hearst Bitcoin Reserve Vault",
  description: "BTC-accumulation instrument backed by real Bitcoin mining, delivered at maturity.",
};

export default async function VaultsPage() {
  const data = await loadVaultPageData();

  // The backend never came back. This is NOT "nothing is configured yet" — the
  // page says so in its own words, and shows no figure at all rather than a
  // zero or a stale guess.
  if (data.state === "error") {
    return (
      <Series1Page>
        <Series1PageTitle
          title="Hearst Bitcoin Reserve Vault — Series 1"
          meta="Vault state unavailable"
          description="BTC-accumulation instrument backed by real Bitcoin mining, structured across three on-chain pockets and delivered at maturity."
        />
        <Series1Panel>
          <Series1PanelHeader title="We couldn’t reach the data" />
          <div className="p-6">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              The service that reports this vault’s state did not respond. The figures below are
              deliberately left blank: nothing here has been estimated, cached or filled in. This is a
              connectivity problem on our side, not a statement about the vault.
            </p>
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Reload in a moment. If it persists, the vault state can be confirmed independently from
              the contract on-chain.
            </p>
          </div>
        </Series1Panel>
      </Series1Page>
    );
  }

  const { snapshot, capacity, strategies, terms, runtime } = data;

  return (
    <Series1Page>
      <Series1PageTitle
        title="Hearst Bitcoin Reserve Vault — Series 1"
        meta={`${vaultModeLabel(runtime)} · Methodology v3.0`}
        description="BTC-accumulation instrument backed by real Bitcoin mining, structured across three on-chain pockets and delivered at maturity."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/proof-center"
              className="inline-flex min-h-10 items-center rounded-lg bg-zinc-800 px-4 text-sm font-semibold text-(--ct-accent-strong) ring-1 ring-(--ct-border-accent) transition-colors hover:bg-zinc-700"
            >
              View proof status
            </Link>
            <Link
              href={investProductPath("HYV-A")}
              className="inline-flex min-h-10 items-center rounded-lg bg-(--ct-accent-strong) px-4 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
            >
              View &amp; subscribe →
            </Link>
          </div>
        }
      />

      <Series1KpiBand
        hero={{
          label: "Total assets",
          // selectExposedFromWired throughout: every one of these is nullable
          // in the backend's own DTO, and a null means "the contract does not
          // report it", never 0.
          value: wiredMetric(
            selectExposedFromWired(snapshot, (s) => s.totalAssets),
            (v) => formatUsdcAmount(BigInt(v)),
          ),
          hint: <Series1Provenance read={snapshot} />,
        }}
        metrics={[
          {
            label: "Total shares",
            // The vault's share receipt uses the asset's own precision (USDC,
            // 6) — the backend reports `assetDecimals` and does not expose a
            // separate share-decimals field.
            value: wiredMetric(
              selectExposedFromWired(snapshot, (s) =>
                s.totalShares === null ? null : { shares: BigInt(s.totalShares), decimals: s.assetDecimals },
              ),
              (v) => formatShareAmount(v.shares, v.decimals),
            ),
            hint: "Share receipts issued",
          },
          {
            label: "TVL cap",
            value: wiredMetric(
              selectExposedFromWired(capacity, (c) => c.tvlCap),
              (cap) => formatUsdcAmount(BigInt(cap)),
            ),
            hint: "Maximum capital accepted",
          },
          {
            label: "NAV per share",
            value: wiredMetric(
              selectExposedFromWired(snapshot, (s) => s.navPerShare),
              (n) => formatNavPerShare(BigInt(n)),
            ),
            hint: "convertToAssets(1 share)",
          },
          // Term and minimum ticket come from the backend factsheet, not from
          // literals: both used to be typed here ("24 months" / "$250k") while
          // /api/v1/product/factsheet already served them, so a spec change
          // would have moved one screen and left this one asserting the old
          // number. When the factsheet is unavailable the cell states the
          // motive — it never falls back to the previous hardcoded string.
          {
            label: "Term",
            value: wiredMetric(
              selectExposedFromWired(terms, (t) => t.productDurationMonths),
              (m) => `${m} months`,
            ),
            hint: "BTC delivered at maturity",
          },
          {
            label: "Minimum ticket",
            value: wiredMetric(
              selectExposedFromWired(terms, (t) => t.minimumDepositUsdc),
              (v) => formatUsdcAmount(BigInt(v)),
            ),
            hint: "Minimum subscription per investor",
          },
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
              {strategies.data.map((s) => (
                <Series1Row
                  key={s.pocket}
                  // The backend labels the pockets itself (B1 "Mining Power",
                  // B2 "BTC Pouch", B3 "Reserve USDC"). Using its labels rather
                  // than the local POCKET_LABELS constant keeps one authority
                  // for what a pocket is called.
                  label={`${s.pocket} · ${s.label}`}
                  // targetBps arrives as a JSON number (bps are small
                  // integers, far below 2^53 — no precision risk, unlike the
                  // uint256 amounts which stay strings end to end).
                  value={formatBps(BigInt(s.targetBps))}
                  hint={s.isIdle ? "Idle — held as reserve" : "Adapter-deployed"}
                />
              ))}
            </Series1RowList>
          ) : (
            <div className="flex flex-col gap-5 p-6">
              {/* Spec constant (40/27/33) shown as the configured target while
                  the live strategies() read is unavailable — labeled policy,
                  never a measurement. `bars` fills the panel width with one
                  gauge per pocket instead of floating a small donut in space. */}
              <HcCompositionRing
                aria-label="Series 1 policy allocation target: B1 40%, B2 27%, B3 33%"
                palette="categorical"
                size={210}
                bars
                centerLabel="Policy target"
                centerValue="40/27/33"
                segments={POLICY_TARGET_BPS.map((bps, i) => ({
                  label: `${POCKET_LABELS[i]?.id ?? `S${i}`} · ${POCKET_LABELS[i]?.label ?? "Strategy"}`,
                  value: bps / 100,
                }))}
              />
              {/* Investor copy, not ops copy: the adapter's raw detail names
                  env vars and deploy steps — that vocabulary stays off this
                  surface. */}
              <p className="border-t border-zinc-950/5 pt-4 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                Configured policy split — not a live allocation. {reasonLabel(strategies.reason)}: the measured
                pocket allocation appears once the v2.1 contract is deployed.
              </p>
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
              <Series1Row label="Contract" value={vaultModeLabel(runtime)} />
              <Series1WiredRow
                label="Underlying asset"
                read={selectFromWired(snapshot, (s) => s.asset)}
                render={(a) => a}
                hint="asset() — read from the contract"
              />
              <Series1WiredRow
                label="Asset decimals"
                read={selectFromWired(snapshot, (s) => s.assetDecimals)}
                render={(d) => d.toString()}
                hint="Accounting precision"
              />
              <Series1Row label="SPV jurisdiction" value="Cayman" />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Maturity & BTC delivery" />
            <Series1RowList>
              <Series1WiredRow
                label="Term"
                read={selectExposedFromWired(terms, (t) => t.productDurationMonths)}
                render={(m) => `${m} months`}
                hint="From subscription settlement"
              />
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
