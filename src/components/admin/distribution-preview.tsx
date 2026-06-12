import type { DistributionRecipient } from "@/app/admin/distributions/actions";
import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";
import { formatUsdDetailed } from "@/lib/vaults/product-display";

interface DistributionPreviewProps {
  period: string;
  totalUsdc: number;
  recipients: DistributionRecipient[];
  className?: string;
}

function abbrWallet(w: string): string {
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

export function DistributionPreview({
  period,
  totalUsdc,
  recipients,
  className,
}: DistributionPreviewProps) {
  if (recipients.length === 0) {
    return (
      <EmptySurface
        variant="widget"
        message="No active positions found."
        detail="Distributions require at least one active investor position."
        className={cn("min-h-32", className)}
      />
    );
  }

  return (
    <div className={cn("admin-doc-stack--relaxed", className)}>
      {/* Summary */}
      <div className="admin-doc-inline-row admin-doc-inline-row--between">
        <div>
          <p className="stat-label">Distribution preview</p>
          <p className="stat-value tabular">{formatUsdDetailed(totalUsdc)} USDC</p>
        </div>
        <div className="text-right">
          <p className="body-xs ct-text-muted">Period</p>
          <p className="stat-label mono">{period}</p>
        </div>
      </div>

      {/* Recipients table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular border border-[var(--ct-border-soft)] rounded-lg overflow-hidden">
          <thead>
            <tr className="ct-surface-1">
              <th className="text-left ct-table-header body-xs ct-text-muted">
                Investor wallet
              </th>
              <th className="text-right ct-table-header body-xs ct-text-muted">
                Share %
              </th>
              <th className="text-right ct-table-header body-xs ct-text-muted">
                Payout (USDC)
              </th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr
                key={r.investorId}
                className="border-t border-[var(--ct-border-soft)] ct-hover-surface transition-colors"
              >
                <td className="ct-table-cell mono text-xs ct-text-body">
                  {abbrWallet(r.walletAddress)}
                </td>
                <td className="ct-table-cell text-right ct-text-muted tabular">
                  {r.sharesPct.toFixed(4)}%
                </td>
                <td className="ct-table-cell text-right ct-text-strong font-semibold tabular">
                  {formatUsdDetailed(r.payoutUsdc)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--ct-border-strong)] ct-surface-2">
              <td className="ct-table-cell body-xs ct-text-muted font-medium">
                Total ({recipients.length} recipients)
              </td>
              <td className="ct-table-cell text-right ct-text-muted tabular text-xs">
                100%
              </td>
              <td className="ct-table-cell text-right ct-text-strong font-bold tabular text-sm">
                {formatUsdDetailed(totalUsdc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Disclaimer — CLAUDE.md #10 */}
      <p className="body-xs ct-text-faint">
        This is a dry-run preview. Amounts shown are indicative and subject to
        rounding. Final confirmation requires multisig approval. Distributions
        are not a commitment to any future return.
      </p>
    </div>
  );
}
