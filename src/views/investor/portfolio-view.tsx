import Link from "next/link";

import { formatShareAmount } from "@/lib/chain/wired-view";
import type { Wired, UserShares, WhitelistStatus } from "@/lib/chain/dynavault";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import type { VaultMode } from "@/lib/chain/vault-mode";
import { formatUsdcGrouped } from "@/lib/vaults/product-display";
import {
  PageActions,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";
import { investProductPath } from "@/lib/vaults/invest-routes";
import { Badge, EmptyState, Kpi, KpiGrid, ProvenanceBadge } from "@/ui";

export function PortfolioView({
  modeLabel,
  wallet,
  shares,
  whitelist,
  positions,
  principalUsdc,
}: {
  mode: VaultMode;
  modeLabel: string;
  wallet: string | null;
  shares: Wired<UserShares>;
  whitelist: Wired<WhitelistStatus>;
  positions: PortfolioPosition[];
  principalUsdc: number;
}) {
  if (!wallet) {
    return (
      <PageLayout>
        <PageHeader
          title="My Position"
          meta={modeLabel}
          description="Your subscription position on the Series 1 vault."
        />
        <EmptyState
          title="No wallet linked"
          description="Link a wallet in Profile to see your on-chain position."
          action={
            <Link href="/profile" className="text-sm text-accent hover:underline">
              Go to Profile
            </Link>
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="My Position"
        meta={modeLabel}
        description="Your share receipts and subscription status — no fabricated zeros."
        actions={
          <PageActions
            primary={{ href: investProductPath("HYV-A"), label: "Subscribe more" }}
          />
        }
      />

      <KpiGrid>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Principal deployed"
              value={
                principalUsdc > 0
                  ? `${formatUsdcGrouped(principalUsdc)} USDC`
                  : "—"
              }
              provenance="live"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Share balance"
              value={
                shares.status === "wired"
                  ? formatShareAmount(shares.data.shares, shares.data.shareDecimals)
                  : "—"
              }
              provenance={shares.status === "wired" ? "attested" : "stale"}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Whitelist"
              value={
                whitelist.status === "wired"
                  ? whitelist.data.whitelisted
                    ? "Yes"
                    : "No"
                  : "—"
              }
              provenance="oracle"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Positions"
              value={String(positions.length)}
              provenance="manual"
            />
          </div>
        </Panel>
      </KpiGrid>

      <Section title="Positions">
        <Panel>
          {positions.length === 0 ? (
            <EmptyState title="No active positions" />
          ) : (
            <RowList>
              {positions.map((p) => (
                <Row
                  key={p.id}
                  label={p.vaultName ?? "Series 1 Reserve Vault"}
                  value={`${formatUsdcGrouped(p.principalUsdc)} USDC`}
                />
              ))}
            </RowList>
          )}
        </Panel>
      </Section>

      <Badge variant="outline">
        <ProvenanceBadge source="live" /> On-chain reads where configured
      </Badge>
    </PageLayout>
  );
}
