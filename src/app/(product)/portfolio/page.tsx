// /portfolio — My Position.
//
// The investor's own position, read per-wallet through the server-only adapter.
// Two distinct honest states must never blur into each other:
//   • no wallet linked  → we cannot ask the contract anything about this user;
//   • wallet linked, contract unavailable → we asked and got a motive back.
// Both render as an explicit line, never as a zero position.
//
// Redeem is described, not executed: no user-write endpoint is validated, and
// the front never touches the contract (docs/frontend-api-only-policy.md).

import Link from "next/link";

import { requireInvestor } from "@/lib/auth/require-investor";
import {
  getVaultMode,
  readUserShares,
  readWhitelist,
  type Wired,
  type UserShares,
  type WhitelistStatus,
} from "@/lib/chain/dynavault";
import { formatShareAmount, formatUsdcAmount, selectWired } from "@/lib/chain/wired-view";
import { loadPortfolio } from "@/lib/data/portfolio";

import { RecentActivity } from "@/components/portfolio/recent-activity";
import { Series1KpiBand } from "@/components/series1-shell/Series1KpiBand";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import {
  Series1Provenance,
  Series1WiredRow,
} from "@/components/series1-shell/Series1Wired";
import { vaultModeLabel, wiredMetric } from "../dashboard/_view";
import { loadPortfolioTerms } from "./_data/portfolio-terms-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Position · Hearst Bitcoin Reserve Vault — Series 1",
  description: "Your position in the Hearst Bitcoin Reserve Vault — shares, value and maturity.",
};

/** A read we never attempted, because no wallet is linked to this account. */
const NO_WALLET: Wired<never> = {
  status: "unavailable",
  reason: "no_wallet",
  detail: "Link the wallet that will receive your share receipts to see your position.",
};

export default async function PortfolioPage() {
  const session = await requireInvestor("/portfolio");
  const wallet = session.walletAddress;
  const mode = getVaultMode();

  // Only ask the chain about a user we can actually name. Without a wallet the
  // question is malformed, so we answer it ourselves rather than sending a
  // zero-address read that would come back looking like an empty position.
  const [[shares, whitelist], terms, portfolio]: [
    [Wired<UserShares>, Wired<WhitelistStatus>],
    Awaited<ReturnType<typeof loadPortfolioTerms>>,
    Awaited<ReturnType<typeof loadPortfolio>>,
  ] = await Promise.all([
    wallet
      ? Promise.all([
          readUserShares(wallet as `0x${string}`),
          readWhitelist(wallet as `0x${string}`),
        ])
      : Promise.resolve([NO_WALLET, NO_WALLET] as [Wired<UserShares>, Wired<WhitelistStatus>]),
    loadPortfolioTerms(),
    // Contribution timeline / records source — the same ledger the retired
    // /portfolio/activity route read. Consolidated here, no sub-page.
    loadPortfolio(),
  ]);

  const hasPosition = shares.status === "wired" && shares.data.shares > 0n;

  return (
    <Series1Page>
      <Series1PageTitle
        title="My Position"
        meta={`${vaultModeLabel(mode)} · Methodology v3.0`}
        description="Your position in the Hearst Bitcoin Reserve Vault — capital deployed, share receipts and delivery at maturity."
        actions={
          !hasPosition ? (
            <Link
              href="/vaults"
              className="inline-flex min-h-10 items-center rounded-lg bg-zinc-800 px-4 text-sm font-medium text-(--ct-accent-strong) ring-1 ring-(--ct-border-accent) transition-colors hover:bg-zinc-700"
            >
              View Series 1 →
            </Link>
          ) : undefined
        }
      />

      <Series1KpiBand
        hero={{
          label: "Position value",
          value: wiredMetric(
            selectWired(shares, (s) => s.assets),
            (a) => formatUsdcAmount(a),
          ),
          hint: <Series1Provenance read={shares} />,
        }}
        metrics={[
          {
            label: "Share receipts",
            value: wiredMetric(
              selectWired(shares, (s) => ({ raw: s.shares, decimals: s.shareDecimals })),
              (s) => formatShareAmount(s.raw, s.decimals),
            ),
            // Legacy reads balanceOf(); v2 reads shares(). Name neither so the
            // hint can not misstate the on-chain function for the active mode.
            hint: "Per-wallet share balance",
          },
          {
            label: "Subscription",
            value: wiredMetric(
              selectWired(whitelist, (w) => w.effectivelyAllowed),
              (allowed) => (allowed ? "Eligible" : "Not eligible"),
            ),
            hint: "Whitelist status",
          },
          {
            label: "BTC accumulated",
            value: "—",
            hint: "Per-investor attribution not exposed on-chain",
          },
          {
            label: "Term",
            value: terms.termMonths !== null ? `${terms.termMonths} months` : "—",
            hint:
              terms.termMonths !== null
                ? "BTC delivered at maturity"
                : terms.reachable
                  ? "Not reported by the product factsheet yet"
                  : "Live terms unreachable",
          },
          { label: "Soft lock-up", value: "60 days", hint: "Class A contractual, not enforced on-chain" },
        ]}
      />

      <Series1Section
        index="01"
        title="Position detail"
        description="Figures below are read per-wallet from the vault contract. They describe your own account only."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Holdings" description={<Series1Provenance read={shares} />} />
            <Series1RowList>
              <Series1WiredRow
                label="Share receipts"
                read={selectWired(shares, (s) => ({ raw: s.shares, decimals: s.shareDecimals }))}
                render={(s) => formatShareAmount(s.raw, s.decimals)}
                hint="Per-wallet share balance"
              />
              <Series1WiredRow
                label="Current value"
                read={selectWired(shares, (s) => s.assets)}
                render={(a) => formatUsdcAmount(a)}
                hint="convertToAssets(shares)"
              />
              <Series1Row
                label="Receiver wallet"
                value={wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Not linked"}
                hint={
                  wallet ? (
                    "Delivery address at maturity"
                  ) : (
                    <Link
                      href="/profile"
                      className="text-(--ct-accent-strong) transition-colors hover:underline"
                    >
                      Link a wallet →
                    </Link>
                  )
                }
              />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Eligibility" description={<Series1Provenance read={whitelist} />} />
            <Series1RowList>
              <Series1WiredRow
                label="Whitelisted"
                read={selectWired(whitelist, (w) => w.whitelisted)}
                render={(w) => (w ? "Yes" : "No")}
                hint="whitelist(address user)"
              />
              <Series1WiredRow
                label="Open access"
                read={selectWired(whitelist, (w) => w.permissionDisabled)}
                render={(p) => (p ? "Permission disabled" : "Permissioned")}
                hint="permissionDisabled()"
              />
              <Series1WiredRow
                label="Can subscribe"
                read={selectWired(whitelist, (w) => w.effectivelyAllowed)}
                render={(a) => (a ? "Eligible" : "Not eligible")}
                hint="Whitelist or open access"
              />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Contribution timeline"
        description="Deposits, proceeds and withdrawals on your account, most recent first. Nothing is invented — an account with no posted activity shows an honest empty state."
      >
        {/* RecentActivity carries its own coque; drop it into the section
            directly, no Series1Panel wrapper (parent controls surface — no
            double coque). Absorbs the retired /portfolio/activity route. */}
        <RecentActivity
          transactions={portfolio.recentTransactions}
          source={portfolio.source}
          updatedAt={portfolio.updatedAt}
        />
      </Series1Section>

      <Series1Section
        index="03"
        title="Records & proof"
        description="Documents, exports and the on-chain evidence behind your position — secondary controls, not separate destinations."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader
              title="Documents & exports"
              description="Statements and tax preview for your own ledger."
            />
            <Series1RowList>
              <Series1Row
                label="Tax preview"
                value={
                  <Link
                    href="/portfolio/tax"
                    className="text-(--ct-accent-strong) transition-colors hover:underline"
                  >
                    View YTD preview →
                  </Link>
                }
                hint="1099 / CRS preview computed from your ledger"
              />
              <Series1Row
                label="Statement export"
                value="On request"
                hint="Arranged through your relationship contact"
              />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader
              title="Proof"
              description="Every claim is backed by an indexed on-chain event."
            />
            <Series1RowList>
              <Series1Row
                label="On-chain evidence"
                value={
                  <Link
                    href="/proof-center"
                    className="text-(--ct-accent-strong) transition-colors hover:underline"
                  >
                    Open Proof Center →
                  </Link>
                }
                hint="Indexed events, provenance and chain / fork label"
              />
              <Series1Row
                label="Provenance"
                value="Chain-backed"
                hint="Simulated or seed data is never shown as proof"
              />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="04"
        title="Maturity & redemption"
        description="What happens at the end of the term, and how a redemption is arranged."
      >
        <Series1Panel>
          <Series1RowList>
            <Series1Row label="Delivery" value="In BTC" hint="Accumulated reserve, at maturity" />
            <Series1Row
              label="Periodic cash"
              value="None"
              hint="The note pays no periodic cash and carries no fixed rate — BTC is delivered at maturity."
            />
            <Series1Row
              label="Redemption"
              value="Arranged off-platform"
              hint="redeem() is a contract operation; it is not executed from this surface."
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <p className="text-xs leading-6 text-(--ct-text-faint)">
        Financial figures reflect your own account only and carry their own provenance. This is a mining note: it
        accumulates BTC over a 24-month term with no periodic cash — accumulated BTC is delivered at
        maturity. Forward figures are projections shown as a range under stated assumptions, not guaranteed.
      </p>
    </Series1Page>
  );
}
