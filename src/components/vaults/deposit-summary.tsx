import { ApyRange } from "@/components/ui/apy-range";
import { NestedPanel, ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { VaultPanelHeader } from "@/components/vaults/vault-flow-primitives";
import type { VaultProduct } from "@/lib/data/vaults";

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
        <ProofRow label="You deposit">
          {amount > 0 ? (
            <span className="mono">${amount.toLocaleString("en-US")} USDC</span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </ProofRow>

        <ProofRow label="Target APY">
          <ApyRange low={vault.apyLow} high={vault.apyHigh} precision={1} />
        </ProofRow>

        <ProofRow label="Est. yearly yield">
          {yearlyYield !== null ? (
            <span className="mono">
              ${yearlyYield.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC
            </span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </ProofRow>

        <ProofRow label="At soft close">
          {totalAtClose !== null ? (
            <span className="mono">
              ~${totalAtClose.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC
            </span>
          ) : (
            <span className="ct-text-muted">—</span>
          )}
        </ProofRow>

        <ProofRow label="Lock-up">{vault.softLockupDays}d soft</ProofRow>

        <ProofRow label="Fees">
          <span className="text-right">
            {mgmtFee.toFixed(2)}% mgmt · {perfFee.toFixed(0)}% perf
            {hurdleFee ? ` · ${hurdleFee.toFixed(1)}% hurdle` : ""}
          </span>
        </ProofRow>

        <p className="body-xs ct-text-faint vault-disclaimer-inset leading-relaxed">
          Yield figures use the midpoint of the APY range — not a commitment of
          future returns. Methodology v1.0.
        </p>
      </div>
    </NestedPanel>
  );
}
