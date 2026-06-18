import {
  PanelStatus,
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { relativeTime } from "@/lib/format/time";

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
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
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
  leafHref,
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
    <PfCockpitPanel variant="wide" aria-label="Recent account activity" className="h-full">
      <PfCockpitPanelHeader
        title="Recent activity"
        provenance={provenance}
        trailing={leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined}
      />

      <div className="pf-recent-activity-list flex-1">
          {displayed.length === 0 ? (
            <PanelStatus
              className="pf-recent-activity-empty"
              message={
                previewZeros ? "No activity yet" : "No transactions yet"
              }
              detail={
                previewZeros
                  ? "Deposits, payouts and withdrawals will appear here."
                  : "Deposits and payouts will appear here."
              }
            />
          ) : null}
          {displayed.map((tx) => (
            <div
              key={tx.id}
              className="pf-recent-activity-row"
            >
              <TxIcon type={tx.type} />

              <div className="pf-recent-activity-row__main">
                <div className="body-sm ct-text-primary font-semibold truncate whitespace-nowrap">
                  {TYPE_LABELS[tx.type] ?? tx.type}
                  {tx.positionVaultName && (
                    <span className="ct-text-muted font-normal">
                      {" "}· {tx.positionVaultName}
                    </span>
                  )}
                </div>
                <div className="pf-recent-activity-row__time stat-label ct-text-muted mono truncate">
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
