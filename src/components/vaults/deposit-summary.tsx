// deposit-summary.tsx — vault deposit summary rows
// Server-compatible (no "use client"), imported by client InvestForm.
// Non-negotiable #1: APY always as range via <ApyRange>.
// Non-negotiable #5: no forbidden words.

import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";

interface SumRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

function SumRow({ label, children, className }: SumRowProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2", className)}>
      <span className="stat-label ct-text-muted">{label}</span>
      <span className="stat-label ct-text-primary text-right tabular">{children}</span>
    </div>
  );
}

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
    <div className="rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 p-5 flex flex-col gap-0">
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-[var(--ct-border-soft)]">
        <p className="eyebrow">Deposit summary</p>
        <div className="body-xs ct-text-faint flex items-center gap-1">
          <ProvenanceBadge kind="estimated" />
        </div>
      </div>

      <SumRow label="You deposit">
        {amount > 0 ? (
          <span className="mono">${amount.toLocaleString("en-US")} USDC</span>
        ) : (
          <span className="ct-text-muted">—</span>
        )}
      </SumRow>

      <SumRow label="Target APY">
        <ApyRange low={vault.apyLow} high={vault.apyHigh} precision={1} className="body-sm" />
      </SumRow>

      <SumRow label="Est. yearly yield">
        {yearlyYield !== null ? (
          <span className="mono">
            ${yearlyYield.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC
          </span>
        ) : (
          <span className="ct-text-muted">—</span>
        )}
      </SumRow>

      <SumRow label="At soft close">
        {totalAtClose !== null ? (
          <span className="mono">
            ~${totalAtClose.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC
          </span>
        ) : (
          <span className="ct-text-muted">—</span>
        )}
      </SumRow>

      <SumRow label="Lock-up">
        <span>{vault.softLockupDays}d soft</span>
      </SumRow>

      <SumRow label="Fees" className="border-0">
        <span className="text-right text-sm">
          {mgmtFee.toFixed(2)}% mgmt · {perfFee.toFixed(0)}% perf
          {hurdleFee ? ` · ${hurdleFee.toFixed(1)}% hurdle` : ""}
        </span>
      </SumRow>

      <p className="body-xs ct-text-faint mt-3 pt-3 border-t border-[var(--ct-border-soft)] leading-relaxed">
        Yield figures use the midpoint of the APY range — not a commitment of
        future returns. Methodology v1.0.
      </p>
    </div>
  );
}
