import type { DistributionRecipient } from "@/app/admin/distributions/actions";
import { cn } from "@/lib/cn";

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
      <div
        className={cn(
          "ct-card text-center space-y-2 py-8",
          className,
        )}
      >
        <p className="ct-text-muted body-sm">No active positions found.</p>
        <p className="body-xs ct-text-faint">
          Distributions require at least one active investor position.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="stat-label">Distribution preview</p>
          <p className="stat-value tabular">${totalUsdc.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC</p>
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
                  ${r.payoutUsdc.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                ${totalUsdc.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
