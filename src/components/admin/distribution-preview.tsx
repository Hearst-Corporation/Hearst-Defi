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
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Summary */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[15px] font-semibold tracking-tight text-white">
            Distribution preview
          </h3>
          <p className="text-[18px] font-medium leading-none tracking-tight tabular-nums text-white">
            {formatUsdDetailed(totalUsdc)} USDC
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <p className="text-[12px] text-zinc-500">Period</p>
          <p className="font-mono text-[13px] font-medium text-white">{period}</p>
        </div>
      </div>

      {/* Recipients table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#15191C]">
        <table className="w-full table-fixed text-left text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-white/5">
              <th className="w-[42%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Investor wallet
              </th>
              <th className="w-[18%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Share %
              </th>
              <th className="w-[40%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Payout (USDC)
              </th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.investorId} className="border-b border-white/5 last:border-0">
                <td className="truncate px-5 py-3 font-mono text-[12px] text-zinc-300">
                  {abbrWallet(r.walletAddress)}
                </td>
                <td className="px-5 py-3 text-right text-zinc-400">
                  {r.sharesPct.toFixed(4)}%
                </td>
                <td className="px-5 py-3 text-right font-medium text-white">
                  {formatUsdDetailed(r.payoutUsdc)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10">
              <td className="px-5 py-3 text-[12px] text-zinc-400">
                Total ({recipients.length} recipients)
              </td>
              <td className="px-5 py-3 text-right text-[12px] text-zinc-400">
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
      <p className="text-[12px] text-zinc-600">
        This is a dry-run preview. Amounts shown are indicative and subject to
        rounding. Final confirmation requires multisig approval. Distributions
        are not a commitment to any future return.
      </p>
    </div>
  );
}
