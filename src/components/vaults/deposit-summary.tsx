import { ApyRange } from "@/components/ui/apy-range";
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
  const yieldAtClose =
    yearlyYield !== null ? yearlyYield * (vault.softLockupDays / 365) : null;
  const totalAtClose =
    yieldAtClose !== null ? amount + yieldAtClose : null;

  // Graphical split: principal vs projected gross yield at soft close.
  const yieldShare =
    totalAtClose !== null && totalAtClose > 0
      ? Math.min(100, (yieldAtClose! / totalAtClose) * 100)
      : 0;
  const principalShare = 100 - yieldShare;

  const mgmtFee = vault.fees.mgmtBps / 100;
  const perfFee = vault.fees.perfBps / 100;
  const hurdleFee = vault.fees.hurdleBps > 0 ? vault.fees.hurdleBps / 100 : null;

  const hasAmount = amount > 0;

  return (
    <div className="vault-flow-flat-section">
      <VaultPanelHeader
        title="Deposit summary"
        trailing={<ProvenanceBadge kind="estimated" />}
      />

      <div className="vault-panel-body vault-deposit-summary">
        {/* Headline — projected total at soft close */}
        <div className="vault-deposit-summary__headline">
          <span className="stat-label ct-text-muted">
            Projected at soft close (gross)
          </span>
          <span className="vault-deposit-summary__total tabular mono">
            {totalAtClose !== null ? `${formatUsdFull(totalAtClose)} USDC` : "—"}
          </span>
        </div>

        {/* Graphical principal ↔ yield split */}
        <div
          className="vault-deposit-summary__bar"
          role="img"
          aria-label={
            hasAmount
              ? `Principal ${formatUsdFull(amount)}, projected gross yield ${formatUsdFull(yieldAtClose ?? 0)} at soft close`
              : "Enter an amount to see the principal and yield split"
          }
        >
          <span
            className="vault-deposit-summary__seg vault-deposit-summary__seg--principal"
            style={{ width: `${hasAmount ? principalShare : 100}%` }}
          />
          {hasAmount && yieldShare > 0 ? (
            <span
              className="vault-deposit-summary__seg vault-deposit-summary__seg--yield"
              style={{ width: `${yieldShare}%` }}
            />
          ) : null}
        </div>

        <div className="vault-deposit-summary__legend">
          <div className="vault-deposit-summary__legend-item">
            <span className="vault-deposit-summary__swatch vault-deposit-summary__swatch--principal" />
            <span className="body-xs ct-text-muted">Principal</span>
            <span className="body-xs tabular mono ct-text-primary">
              {hasAmount ? `${formatUsdFull(amount)} USDC` : "—"}
            </span>
          </div>
          <div className="vault-deposit-summary__legend-item">
            <span className="vault-deposit-summary__swatch vault-deposit-summary__swatch--yield" />
            <span className="body-xs ct-text-muted">
              Est. gross yield · {vault.softLockupDays}d
            </span>
            <span className="body-xs tabular mono ct-text-primary">
              {yieldAtClose !== null ? `~${formatUsdFull(yieldAtClose)}` : "—"}
            </span>
          </div>
        </div>

        {/* Key figures grid */}
        <dl className="vault-deposit-summary__kpis">
          <div>
            <dt className="stat-label">Target APY</dt>
            <dd>
              <ApyRange
                low={vault.apyLow}
                high={vault.apyHigh}
                precision={1}
                className="body-sm mono tabular-nums ct-text-strong"
              />
            </dd>
          </div>
          <div>
            <dt className="stat-label">Est. gross yield (p.a.)</dt>
            <dd className="body-sm tabular mono ct-text-strong">
              {yearlyYield !== null ? `~${formatUsdFull(yearlyYield)}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="stat-label">Lock-up</dt>
            <dd className="body-sm tabular mono ct-text-strong">
              {vault.softLockupDays}d soft
            </dd>
          </div>
          <div>
            <dt className="stat-label">Fees</dt>
            <dd className="body-sm mono ct-text-strong">
              {mgmtFee.toFixed(2)}% · {perfFee.toFixed(0)}%
              {hurdleFee ? ` · ${hurdleFee.toFixed(1)}%` : ""}
            </dd>
          </div>
        </dl>

        <p className="body-xs ct-text-faint vault-disclaimer-inset ct-leading-relaxed">
          Figures shown are gross (before fees). Net yield after management and performance
          fees will be lower. Uses APY range midpoint — not a commitment of future returns.
          Methodology v1.0.
        </p>
      </div>
    </div>
  );
}
