import { EmptySurface } from "@/components/ui/empty-surface";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Investor-facing labels for transaction types. Keys match the DB `tx.type`
// values and MUST NOT change; only the displayed label is investor-friendly.
// A vault "distribution" is shown to investors as a "Payout".
const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

/** Ghost rows for layout preview — shell visible at zero, not an empty-state swap. */
const PREVIEW_ZERO_ROWS: { type: keyof typeof TYPE_LABELS }[] = [
  { type: "deposit" },
  { type: "distribution" },
  { type: "withdraw" },
];

/** Returns a relative time string like "3 days ago", "1 month ago". */
function relativeTime(date: Date, asOf: Date): string {
  const diffMs = asOf.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

// Placeholder icon for each tx type
function TxIcon({ type }: { type: string }) {
  const iconClass =
    type === "deposit"
      ? "pf-tx-icon--deposit"
      : type === "distribution"
        ? "pf-tx-icon--distribution"
        : type === "withdraw"
          ? "pf-tx-icon--withdraw"
          : "pf-tx-icon--default";

  return <span aria-hidden className={cn("pf-tx-icon", iconClass)} />;
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
  updatedAt?: Date;
  /** Render activity shell with empty list (layout preview). */
  previewZeros?: boolean;
}

/**
 * 5 latest transactions with icon, type, amount, and relative time.
 * ProvenanceBadge on the header (CLAUDE.md non-negotiable #2).
 */
export function RecentActivity({
  transactions,
  source,
  updatedAt,
  previewZeros = false,
}: RecentActivityProps) {
  const displayed = transactions.slice(0, 5);
  const isEmpty = displayed.length === 0;
  const showZeroShell = previewZeros || isEmpty;
  const provenance = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt);
  // Server-rendered timestamp keeps relative labels current without client JS.
  const asOf = new Date();

  return (
    <PfCockpitPanel variant="wide" aria-label="Recent account activity">
      <PfCockpitPanelHeader title="Recent activity" provenance={provenance} />

      <div className="flex flex-col gap-1">
          {displayed.length === 0 && !previewZeros ? (
            <EmptySurface
              variant="inline"
              message="No transactions yet — deposits and payouts will appear here."
            />
          ) : null}
          {displayed.length === 0 && previewZeros ? (
            <>
              {PREVIEW_ZERO_ROWS.map((row) => (
                <div
                  key={row.type}
                  className="flex items-center gap-3 py-2 border-b border-(--ct-border-soft) last:border-0 opacity-50"
                  aria-hidden
                >
                  <TxIcon type={row.type} />
                  <div className="flex-1 min-w-0">
                    <div className="body-sm ct-text-muted font-semibold">
                      {TYPE_LABELS[row.type]}
                    </div>
                    <div className="stat-label ct-text-faint mt-0.5 mono">—</div>
                  </div>
                  <span className="tabular body-md ct-text-faint mono font-semibold shrink-0">
                    $0
                  </span>
                </div>
              ))}
              <p className="body-xs ct-text-faint m-0 mt-1">
                Placeholder rows — activity appears after your first deposit or payout.
              </p>
            </>
          ) : null}
          {displayed.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 py-2 border-b border-(--ct-border-soft) last:border-0"
            >
              <TxIcon type={tx.type} />

              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="body-sm ct-text-primary font-semibold truncate">
                  {TYPE_LABELS[tx.type] ?? tx.type}
                  {tx.positionVaultName && (
                    <span className="ct-text-muted font-normal">
                      {" "}· {tx.positionVaultName}
                    </span>
                  )}
                </div>
                <div className="stat-label ct-text-muted mt-0.5 mono truncate">
                  {relativeTime(tx.occurredAt, asOf)}
                </div>
              </div>

              <span className="tabular body-md ct-text-strong mono font-semibold shrink-0 whitespace-nowrap">
                {usdFmt.format(tx.amountUsdc)}
              </span>
            </div>
          ))}
      </div>
    </PfCockpitPanel>
  );
}
