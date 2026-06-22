import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { relativeTime } from "@/lib/format/time";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

const ICONS = {
  in: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7-7 7 7" />
    </svg>
  ),
  out: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7 7 7-7" />
    </svg>
  ),
} as const;

function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
  updatedAt?: Date;
  /** Server reference time — must match the portfolio hub `now`. */
  asOf?: Date;
  leafHref?: string;
  embedded?: boolean;
}

export function RecentActivity({
  transactions,
  source,
  updatedAt,
  asOf: asOfProp,
  leafHref,
  embedded = false,
}: RecentActivityProps) {
  const displayed = transactions.slice(0, 5);
  const hasTransactions = displayed.length > 0;
  const provenance = hasTransactions ? resolveProvenance(source, updatedAt) : undefined;
  const asOf = asOfProp ?? new Date();
  const trailing = leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Recent account activity"
      className={embedded ? undefined : "h-full"}
    >
      <DashboardPanelHeader
        title="Recent Activity"
        tone="primary"
        provenance={hasTransactions ? provenance : undefined}
        trailing={trailing}
      />
      {hasTransactions ? (
        <div className="pf-activity">
          {displayed.map((tx) => {
            const dir = flowSign(tx.type);
            return (
              <div key={tx.id} className="pf-activity__row group">
                <span className={cn(
                  "pf-activity__glyph",
                  dir === "in" ? "ct-text-accent" : "ct-text-muted"
                )} aria-hidden>
                  {ICONS[dir]}
                </span>
                <span className="pf-activity__main min-w-0">
                  <span className="body-sm ct-text-primary font-semibold truncate">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName ? (
                      <span className="ct-text-tertiary font-normal"> · {tx.positionVaultName}</span>
                    ) : null}
                  </span>
                  <span className="pf-activity__meta truncate">
                    {relativeTime(tx.occurredAt, asOf)}
                  </span>
                </span>
                <span className={cn(
                  "pf-activity__amt",
                  dir === "in" ? "ct-text-accent" : "ct-text-strong"
                )}>
                  {dir === "out" ? "−" : "+"}
                  {formatUsdCompact(tx.amountUsdc)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        /* Zero-state text — plain and honest empty state instead of skeleton rows
           since we're cleaning up the empty states to be more explicit. */
        <div className="pf-activity pf-activity--empty" aria-label="No activity yet">
          <span className="pf-activity__empty-lead">No recent activity</span>
          <span className="pf-activity__empty-hint ct-text-muted">
            Your recent deposits, withdrawals, and distribution payouts will appear here.
          </span>
        </div>
      )}
    </PfCockpitPanel>
  );
}
