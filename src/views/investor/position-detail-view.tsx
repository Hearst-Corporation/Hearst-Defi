import {
  POSITION_STATUS_CONFIG,
  type PositionDetail,
} from "@/lib/data/portfolio";
import { explorerTxUrl } from "@/lib/chain/explorer";
import { daysSince, formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  ProvenanceBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import {
  Disclaimer,
  PageActions,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";

const TX_LABEL: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Proceeds",
};

export function PositionDetailView({ position }: { position: PositionDetail }) {
  const statusCfg = POSITION_STATUS_CONFIG[position.status];
  const elapsedDays = daysSince(position.subscribedAt);
  const lockDays = position.softLockupDays;
  const lockDay =
    lockDays > 0 ? Math.min(lockDays, Math.max(0, elapsedDays)) : null;
  const apyRange =
    position.realizedApyLow != null && position.realizedApyHigh != null
      ? `${position.realizedApyLow.toFixed(1)}–${position.realizedApyHigh.toFixed(1)}%`
      : "—";

  return (
    <PageLayout>
      <PageHeader
        eyebrow="My position"
        title={position.vaultName ?? "Series 1 Reserve Vault"}
        meta={position.vaultTicker}
        description="BTC-accumulation note — principal deployed, contractual soft-lock, and ledger activity."
        actions={
          <PageActions
            primary={{ href: "/proof-center", label: "Proof Center" }}
            secondary={{ href: "/portfolio", label: "All positions" }}
          />
        }
      />

      <KpiGrid>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Principal"
              value={formatUsdFull(position.principalUsdc)}
              provenance="live"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Status"
              value={statusCfg.label}
              provenance="manual"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Soft lock"
              value={
                lockDay !== null && lockDays > 0
                  ? `Day ${lockDay} of ${lockDays}`
                  : lockDays > 0
                    ? `${lockDays} days`
                    : "—"
              }
              provenance="manual"
              hint="Contractual — not enforced on-chain"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Est. range"
              value={apyRange}
              provenance="estimated"
              hint="Accumulated BTC delivery range — not guaranteed"
            />
          </div>
        </Panel>
      </KpiGrid>

      <Section title="Position details">
        <Panel>
          <RowList>
            <Row
              label="Subscribed"
              value={formatAdminDate(position.subscribedAt)}
            />
            <Row
              label="Opening transaction"
              value={
                position.txHashOpen ? (
                  <a
                    href={explorerTxUrl(position.txHashOpen)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {position.txHashOpen.slice(0, 10)}…
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Distributed"
              value={formatUsdFull(position.distributedUsdc)}
            />
            {position.pnl ? (
              <Row
                label="P&L (ledger)"
                value={formatUsdFull(position.pnl.totalReturnUsdc)}
                hint="From principal, distributions and accrual columns — not a promise"
              />
            ) : null}
          </RowList>
        </Panel>
      </Section>

      <Section title="Ledger activity">
        <Panel>
          {position.transactions.length === 0 ? (
            <EmptyState title="No ledger rows yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {position.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TX_LABEL[tx.type] ?? tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatUsdFull(tx.amountUsdc)}
                    </TableCell>
                    <TableCell className="text-sm text-muted">
                      {formatAdminDate(tx.occurredAt)}
                    </TableCell>
                    <TableCell>
                      {tx.txHash ? (
                        <a
                          href={explorerTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          View ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>

      <Badge variant="outline">
        <ProvenanceBadge source="live" /> Ledger-backed position data
      </Badge>

      <Disclaimer>
        Estimated outcomes are disclosed as a range — not guaranteed. No periodic
        cash distribution on Series 1.
      </Disclaimer>
    </PageLayout>
  );
}
