import type { DistributionRecipient } from "@/app/admin/distributions/actions";
import { EmptySurface } from "@/components/catalyst/empty-surface";
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
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Summary */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[length:var(--ct-text-sm)] font-semibold tracking-tight text-white">
            Distribution preview
          </h3>
          <p className="text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums text-white">
            {formatUsdDetailed(totalUsdc)} USDC
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">Period</p>
          <p className="font-mono text-[length:var(--ct-text-xs)] font-medium text-white">{period}</p>
        </div>
      </div>

      {/* Recipients table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-inset">
        <table className="w-full table-fixed text-left text-[length:var(--ct-text-xs)] tabular-nums">
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)]">
              <th className="w-[42%] px-5 py-3 text-left ct-bento-label">
                Investor wallet
              </th>
              <th className="w-[18%] px-5 py-3 text-right ct-bento-label">
                Share %
              </th>
              <th className="w-[40%] px-5 py-3 text-right ct-bento-label">
                Payout (USDC)
              </th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.investorId} className="border-b border-[var(--ct-border-soft)] last:border-0">
                <td className="truncate px-5 py-3 font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
                  {abbrWallet(r.walletAddress)}
                </td>
                <td className="px-5 py-3 text-right text-[var(--ct-text-muted)]">
                  {r.sharesPct.toFixed(4)}%
                </td>
                <td className="px-5 py-3 text-right font-medium text-white">
                  {formatUsdDetailed(r.payoutUsdc)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--ct-border)]">
              <td className="px-5 py-3 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                Total ({recipients.length} recipients)
              </td>
              <td className="px-5 py-3 text-right text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                100%
              </td>
              <td className="px-5 py-3 text-right font-medium text-white">
                {formatUsdDetailed(totalUsdc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Disclaimer — CLAUDE.md #10 */}
      <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
        This is a dry-run preview. Amounts shown are indicative and subject to
        rounding. Final confirmation requires multisig approval. Distributions
        are not a commitment to any future return.
      </p>
    </div>
  );
}
