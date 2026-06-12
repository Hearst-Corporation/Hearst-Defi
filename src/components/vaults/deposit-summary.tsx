import { ApyRange } from "@/components/ui/apy-range";
import { DataRow, NestedPanel } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultPanelHeader } from "@/components/vaults/vault-flow-primitives";
import type { VaultProduct } from "@/lib/data/vaults";
import { formatUsdFull } from "@/lib/vaults/product-display";

interface DepositSummaryProps {
  vault: VaultProduct;
  amount: number;
}

export function DepositSummary({ vault, amount }: DepositSummaryProps) {
  const midApy = (vault.apyLow + vault.apyHigh) / 2;
  const yearlyYield = amount > 0 ? (amount * midApy) / 100 : null;
  const totalAtClose = yearlyYield
    ? amount + yearlyYield * (vault.softLockupDays / 365)
    : null;

  const mgmtFee = vault.fees.mgmtBps / 100;
  const perfFee = vault.fees.perfBps / 100;
  const hurdleFee = vault.fees.hurdleBps > 0 ? vault.fees.hurdleBps / 100 : null;

  return (
    <NestedPanel className="py-0">
      <VaultPanelHeader
        title="Deposit summary"
        trailing={<ProvenanceBadge kind="estimated" />}
      />

      <div className="vault-panel-body">
        <DataRow label="You deposit">
          {amount > 0 ? (
            <span className="mono">{formatUsdFull(amount)} USDC</span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </DataRow>

        <DataRow label="Target APY">
          <ApyRange
            low={vault.apyLow}
            high={vault.apyHigh}
            precision={1}
            className="stat-value mono tabular-nums ct-text-strong"
          />
        </DataRow>

        <DataRow label="Est. yearly yield">
          {yearlyYield !== null ? (
            <span className="mono">
              {formatUsdFull(yearlyYield)} USDC
            </span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </DataRow>

        <DataRow label="At soft close">
          {totalAtClose !== null ? (
            <span className="mono">
              ~{formatUsdFull(totalAtClose)} USDC
            </span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </DataRow>

        <DataRow label="Lock-up">{vault.softLockupDays}d soft</DataRow>

        <DataRow label="Fees">
          {mgmtFee.toFixed(2)}% mgmt · {perfFee.toFixed(0)}% perf
          {hurdleFee ? ` · ${hurdleFee.toFixed(1)}% hurdle` : ""}
        </DataRow>

        <p className="body-xs ct-text-faint vault-disclaimer-inset ct-leading-relaxed">
          Yield figures use the midpoint of the APY range — not a commitment of
          future returns. Methodology v1.0.
        </p>
      </div>
    </NestedPanel>
  );
}
