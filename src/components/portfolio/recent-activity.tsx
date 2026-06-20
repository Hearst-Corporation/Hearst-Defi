import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { relativeTime } from "@/lib/format/time";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
  updatedAt?: Date;
  leafHref?: string;
  embedded?: boolean;
}

export function RecentActivity({
  transactions,
  source,
  updatedAt,
  leafHref,
  embedded = false,
}: RecentActivityProps) {
  const displayed = transactions.slice(0, 5);
  const hasTransactions = displayed.length > 0;
  const provenance = hasTransactions ? resolveProvenance(source, updatedAt) : undefined;
  const asOf = new Date();
  const trailing = leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Recent account activity"
      className="h-full"
    >
      <PfCockpitPanelHeader
        title="Recent Activity"
        provenance={hasTransactions ? provenance : undefined}
        trailing={trailing}
      />
      {hasTransactions ? (
        <div className="pf-activity">
          {displayed.map((tx) => {
            const dir = flowSign(tx.type);
            return (
              <div key={tx.id} className="pf-activity__row">
                <span className="pf-activity__glyph" data-dir={dir} aria-hidden>
                  {dir === "in" ? "▲" : "▼"}
                </span>
                <span className="pf-activity__main min-w-0">
                  <span className="body-sm ct-text-primary font-semibold truncate">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName ? (
                      <span className="ct-text-muted font-normal"> · {tx.positionVaultName}</span>
                    ) : null}
                  </span>
                  <span className="stat-label ct-text-muted mono truncate">
                    {relativeTime(tx.occurredAt, asOf)}
                  </span>
                </span>
                <span className="pf-activity__amt tabular body-md mono font-semibold">
                  {dir === "out" ? "−" : "+"}
                  {usdFmt.format(tx.amountUsdc)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pf-activity pf-activity--empty">
          <p className="pf-activity__empty-lead body-sm ct-text-muted m-0">No transactions yet</p>
          <p className="pf-activity__empty-hint body-xs ct-text-faint m-0">
            Deposits and payouts will appear here.
          </p>
        </div>
      )}
    </PfCockpitPanel>
  );
}
