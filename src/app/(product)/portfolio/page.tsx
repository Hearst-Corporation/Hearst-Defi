// /portfolio — My Position (MONDE B: the single investor home, backend-sourced).
//
// This is the accueil the logged-in investor lands on. The LAYOUT is unchanged
// from the consolidated position console — KPI band + four numbered sections —
// but the DATA now comes from hearst-connect-backend through `loadMyPosition`
// (the `getDashboardFromBackend` per-user DTO), NOT from the chain adapter
// (`readUserShares`/`readWhitelist`, viem) or the Prisma ledger (`loadPortfolio`).
// One business fact, one source, and it is the backend — the same rule /vaults
// and /dashboard already follow (endpoint-to-ui-matrix.md §A row 1).
//
// The retired /dashboard fund overview redirects here: this page is the
// investor's home. The two honest states must never blur:
//   • whole read never answered  → an explicit "couldn't reach the data" line;
//   • answered, field absent      → "not reported", never a zero position.
//
// Redeem is described, not executed: the front never touches the contract
// (docs/frontend-api-only-policy.md).

import Link from "next/link";

import { requireInvestor } from "@/lib/auth/require-investor";
import type { PortfolioTransaction } from "@/lib/data/portfolio";

import { RecentActivity } from "@/components/portfolio/recent-activity";
import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { POSITION_CARD_SURFACE } from "./_charts/position-surface";
import {
  Series1Provenance,
  Series1WiredRow,
} from "@/components/series1-shell/Series1Wired";
import { wiredMetric } from "../dashboard/_view";
// The BACKEND-aware mode label (handles "v2-fork" / "v2-mainnet" / "v2-testnet",
// the wider vocabulary the backend reports) — NOT the chain adapter's narrow
// three-value `vaultModeLabel` in _view.ts.
import { vaultModeLabel } from "@/lib/backend/resolved-view";
import { loadMyPosition, toFlowType, type PositionActivityItem } from "./_data/position-loader";
import { PositionCharts } from "./_charts/position-charts";
import { PositionHeroBand } from "./_charts/position-hero-band";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Position · Hearst Bitcoin Reserve Vault — Series 1",
  description: "Your position in the Hearst Bitcoin Reserve Vault — shares, value and maturity.",
};

/**
 * The backend reports position monetary figures as ALREADY-FORMATTED USDC
 * decimal strings (see position-loader.ts). Render them with a plain " USDC"
 * suffix — never through formatUsdcAmount (that divides by 10^6). A null value
 * is handled upstream by the Wired envelope, so this only ever sees a string.
 */
const usdc = (decimalString: string): string => `${decimalString} USDC`;

/** Backend activity → the timeline component's transaction shape. Amount is a
 *  decimal USDC string → number; type is already the closed flow vocabulary,
 *  guarded by `toFlowType`; occurredAt is ISO → Date. */
function toTransaction(item: PositionActivityItem, index: number): PortfolioTransaction {
  return {
    id: item.txHash ?? `activity-${index}`,
    type: toFlowType(item.type),
    amountUsdc: Number.parseFloat(item.amountUsdc),
    occurredAt: new Date(item.occurredAt),
    txHash: item.txHash,
  };
}

export default async function PortfolioPage() {
  await requireInvestor("/portfolio");
  const position = await loadMyPosition();

  const { holdings, eligibility, termMonths, allocation, capacity, activity, hasPosition, runtimeMode } =
    position;
  const wallet =
    eligibility.status === "wired" ? eligibility.data.walletAddress : null;
  const transactions = activity.map(toTransaction);

  return (
    <Series1Page>
      <Series1PageTitle
        title="My Position"
        meta={`${vaultModeLabel({ mode: runtimeMode })} · Methodology v3.0`}
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

      <PositionHeroBand
        eyebrow="Hearst Bitcoin Reserve Vault · Series 1"
        headlineLabel="Position value"
        headlineValue={wiredMetric(holdings, (h) => (h.value !== null ? usdc(h.value) : "—"))}
        headlineHint={<Series1Provenance read={holdings} />}
        metrics={[
          {
            label: "Share receipts",
            value: wiredMetric(holdings, (h) => h.shares ?? "—"),
            hint: "Per-wallet share balance",
          },
          {
            label: "Subscription",
            value: wiredMetric(eligibility, (e) =>
              e.userEligible === null ? "—" : e.userEligible ? "Eligible" : "Not eligible",
            ),
            hint: "Whitelist status",
          },
          {
            label: "Term",
            value: wiredMetric(termMonths, (m) => (m !== null ? `${m} months` : "—")),
            hint: "BTC delivered at maturity",
          },
        ]}
      />

      <Series1Section
        index="01"
        title="Allocation & capacity"
        description="Where your capital sits and how the vault fills — read from the backend, most-recent-first."
      >
        <PositionCharts allocation={allocation} capacity={capacity} activity={activity} />
      </Series1Section>

      <Series1Section
        index="02"
        title="Position detail"
        description="Figures below are read per-wallet from the vault, via the backend. They describe your own account only."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={POSITION_CARD_SURFACE}>
            <Series1PanelHeader title="Holdings" description={<Series1Provenance read={holdings} />} />
            <Series1RowList>
              <Series1WiredRow
                label="Share receipts"
                read={holdings}
                render={(h) => h.shares ?? "—"}
                hint="Per-wallet share balance"
              />
              <Series1WiredRow
                label="Current value"
                read={holdings}
                render={(h) => (h.value !== null ? usdc(h.value) : "—")}
                hint="Position value reported by the backend"
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
          </div>

          <div className={POSITION_CARD_SURFACE}>
            <Series1PanelHeader title="Eligibility" description={<Series1Provenance read={eligibility} />} />
            <Series1RowList>
              <Series1WiredRow
                label="Whitelisted"
                read={eligibility}
                render={(e) => (e.whitelisted === null ? "—" : e.whitelisted ? "Yes" : "No")}
                hint="Per-account whitelist status"
              />
              <Series1WiredRow
                label="Open access"
                read={eligibility}
                render={(e) => (e.whitelistRequired ? "Permissioned" : "Permission disabled")}
                hint="Whether the vault gates subscription"
              />
              <Series1WiredRow
                label="Can subscribe"
                read={eligibility}
                render={(e) => (e.userEligible === null ? "—" : e.userEligible ? "Eligible" : "Not eligible")}
                hint="Whitelist or open access"
              />
            </Series1RowList>
          </div>
        </div>
      </Series1Section>

      <Series1Section
        index="03"
        title="Contribution timeline"
        description="Deposits, proceeds and withdrawals on your account, most recent first. Nothing is invented — an account with no posted activity shows an honest empty state."
      >
        {/* RecentActivity carries its own coque; drop it into the section
            directly, no Series1Panel wrapper (parent controls surface — no
            double coque). Fed from the backend activity block. */}
        <RecentActivity
          transactions={transactions}
          // The backend's per-user read IS the live ledger; provenance detail
          // rides on each Wired block above, not on this timeline chrome.
          source="live"
        />
      </Series1Section>

      <Series1Section
        index="04"
        title="Records & proof"
        description="Documents, exports and the on-chain evidence behind your position — secondary controls, not separate destinations."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={POSITION_CARD_SURFACE}>
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
            </Series1RowList>
          </div>

          <div className={POSITION_CARD_SURFACE}>
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
            </Series1RowList>
          </div>
        </div>
      </Series1Section>
    </Series1Page>
  );
}
