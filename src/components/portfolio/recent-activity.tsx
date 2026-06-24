import { ArrowUpRight, ArrowDownLeft, Wallet, Receipt, ArrowDownRight, CircleDollarSign } from "lucide-react";
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

function TransactionIcon({ type, dir }: { type: string; dir: "in" | "out" }) {
  const className = "w-3.5 h-3.5";
  if (type === "deposit") return <Wallet className={className} />;
  if (type === "distribution") return <CircleDollarSign className={className} />;
  if (type === "withdraw") return <ArrowDownRight className={className} />;
  if (type === "claim") return <Receipt className={className} />;
  
  return dir === "in" ? (
    <ArrowUpRight className={className} />
  ) : (
    <ArrowDownLeft className={className} />
  );
}

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
        subtitle="Last 5 transactions"
        titleVariant="primary"
        provenance={hasTransactions ? provenance : undefined}
        trailing={trailing}
      />
      {hasTransactions ? (
        <div className="pf-activity">
          {displayed.map((tx) => {
            const dir = flowSign(tx.type);
            return (
              <div key={tx.id} className="pf-activity__row group/row">
                <span className="pf-activity__glyph" data-dir={dir} aria-hidden>
                  <TransactionIcon type={tx.type} dir={dir} />
                </span>
                <span className="pf-activity__main min-w-0">
                  <span className="text-sm ct-text-primary font-semibold truncate transition-colors group-hover/row:ct-text-accent">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName ? (
                      <span className="ct-text-muted font-normal"> · {tx.positionVaultName}</span>
                    ) : null}
                  </span>
                  <span className="stat-label ct-text-muted mono truncate">
                    {relativeTime(tx.occurredAt, asOf)}
                  </span>
                </span>
                <span className="pf-activity__amt tabular text-sm mono font-semibold transition-colors group-hover/row:ct-text-accent">
                  {dir === "out" ? "−" : "+"}
                  {usdFmt.format(tx.amountUsdc)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        /* Zero-state skeleton — muted placeholder rows, no phrase. Fills in
           with real transactions as soon as the first one lands. */
        <div className="pf-activity pf-activity--skeleton" aria-label="No activity yet">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="pf-activity__row pf-activity__row--skeleton" aria-hidden>
              <span className="pf-skeleton-glyph" />
              <span className="pf-activity__main min-w-0">
                <span className="pf-skeleton-bar pf-skeleton-bar--label" />
                <span className="pf-skeleton-bar pf-skeleton-bar--meta" />
              </span>
              <span className="pf-skeleton-bar pf-skeleton-bar--amt" />
            </div>
          ))}
        </div>
      )}
    </PfCockpitPanel>
  );
}
