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
    <div className={cn("admin-doc-stack admin-doc-stack--relaxed", className)}>
      {/* Summary */}
      <div className="admin-doc-inline-row admin-doc-inline-row--between">
        <div>
          <h3 className="h3">Distribution preview</h3>
          <p className="stat-value tabular">{formatUsdDetailed(totalUsdc)} USDC</p>
        </div>
        <div className="text-right">
          <p className="body-xs ct-text-muted">Period</p>
          <p className="stat-label mono">{period}</p>
        </div>
      </div>

      {/* Recipients table */}
      <div className="overflow-hidden">
        <table className="w-full table-fixed body-sm tabular">
          <thead>
            <tr>
              <th className="w-[42%] text-left stat-label ct-table-header">
                Investor wallet
              </th>
              <th className="w-[18%] text-right stat-label ct-table-header">
                Share %
              </th>
              <th className="w-[40%] text-right stat-label ct-table-header">
                Payout (USDC)
              </th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.investorId} className="border-t border-(--ct-border-soft)">
                <td className="ct-table-cell mono body-xs ct-text-body truncate">
                  {abbrWallet(r.walletAddress)}
                </td>
                <td className="ct-table-cell text-right ct-text-muted tabular">
                  {r.sharesPct.toFixed(4)}%
                </td>
                <td className="ct-table-cell text-right ct-text-strong tabular body-sm">
                  {formatUsdDetailed(r.payoutUsdc)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-(--ct-border-strong)">
              <td className="ct-table-cell body-xs ct-text-muted">
                Total ({recipients.length} recipients)
              </td>
              <td className="ct-table-cell text-right ct-text-muted tabular body-xs">
                100%
              </td>
              <td className="ct-table-cell text-right ct-text-strong tabular body-sm">
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
