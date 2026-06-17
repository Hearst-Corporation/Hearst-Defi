import { ApyRange } from "@/components/ui/apy-range";
import { DataRow, NestedPanel } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultPanelHeader } from "@/components/vaults/vault-flow-primitives";
import { demoProvenance } from "@/lib/demo/markers";
import type { VaultProduct } from "@/lib/data/vaults";
import { formatUsdFull } from "@/lib/vaults/product-display";

interface DepositSummaryProps {
  vault: VaultProduct;
  amount: number;
  /** Demo sandbox path — renders "simulated" provenance instead of "estimated". */
  demo?: boolean;
}

export function DepositSummary({ vault, amount, demo = false }: DepositSummaryProps) {
  const midApy = (vault.apyLow + vault.apyHigh) / 2;
  const yearlyYield = amount > 0 ? (amount * midApy) / 100 : null;
  const totalAtClose = yearlyYield
    ? amount + yearlyYield * (vault.softLockupDays / 365)
    : null;

  const mgmtFee = vault.fees.mgmtBps / 100;
  const perfFee = vault.fees.perfBps / 100;
  const hurdleFee = vault.fees.hurdleBps > 0 ? vault.fees.hurdleBps / 100 : null;

  return (
    <NestedPanel variant="borderless" className="py-0">
      <VaultPanelHeader
        title="Deposit summary"
        trailing={<ProvenanceBadge kind={demoProvenance(demo, "estimated")} />}
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

        <DataRow label="Est. gross yield (p.a.)">
          {yearlyYield !== null ? (
            <span className="mono">
              ~{formatUsdFull(yearlyYield)} USDC
            </span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </DataRow>

        <DataRow label="At soft close (gross)">
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
          Figures shown are gross (before fees). Net yield after management and performance
          fees will be lower. Uses APY range midpoint — not a commitment of future returns.
          Methodology v1.0.
        </p>
      </div>
    </NestedPanel>
  );
}
