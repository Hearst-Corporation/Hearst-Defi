import type { DistributionRecipient } from "@/app/admin/distributions/actions";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
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
          <h3 className="text-[length:var(--ct-text-sm)] font-semibold tracking-tight text-[var(--ct-text-strong)]">
            Distribution preview
          </h3>
          <p className="text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums text-[var(--ct-text-strong)]">
            {formatUsdDetailed(totalUsdc)} USDC
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">Period</p>
          <p className="mono text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-strong)]">{period}</p>
        </div>
      </div>

      {/* Recipients table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-inset">
        <Table className="[&_table]:w-full [&_table]:table-fixed [&_table]:text-[length:var(--ct-text-xs)] [&_table]:tabular-nums">
          <TableHead>
            <TableRow className="border-b border-[var(--ct-border-soft)]">
              <TableHeader className="w-[42%] px-5 py-3 text-left ct-bento-label">
                Investor wallet
              </TableHeader>
              <TableHeader className="w-[18%] px-5 py-3 text-right ct-bento-label">
                Share %
              </TableHeader>
              <TableHeader className="w-[40%] px-5 py-3 text-right ct-bento-label">
                Payout (USDC)
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.investorId} className="border-b border-[var(--ct-border-soft)] last:border-0">
                <TableCell className="truncate px-5 py-3 mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
                  {abbrWallet(r.walletAddress)}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-[var(--ct-text-muted)]">
                  {r.sharesPct.toFixed(4)}%
                </TableCell>
                <TableCell className="px-5 py-3 text-right font-medium text-[var(--ct-text-strong)]">
                  {formatUsdDetailed(r.payoutUsdc)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="border-t border-[var(--ct-border)]">
              <TableCell className="px-5 py-3 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                Total ({recipients.length} recipients)
              </TableCell>
              <TableCell className="px-5 py-3 text-right text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
                100%
              </TableCell>
              <TableCell className="px-5 py-3 text-right font-medium text-[var(--ct-text-strong)]">
                {formatUsdDetailed(totalUsdc)}
              </TableCell>
            </TableRow>
          </tfoot>
        </Table>
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
