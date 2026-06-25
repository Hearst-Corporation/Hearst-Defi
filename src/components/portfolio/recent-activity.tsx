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
          {displayed.map((tx, idx) => {
            const dir = flowSign(tx.type);
            return (
              <div
                key={tx.id}
                className="pf-activity__row group/row"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <span className="pf-activity__glyph" data-dir={dir} aria-hidden>
                  <TransactionIcon type={tx.type} dir={dir} />
                </span>
                <span className="pf-activity__main min-w-0">
                  <span className="text-[var(--ct-text-xs)] ct-text-primary font-medium tracking-tight truncate transition-colors group-hover/row:ct-text-accent">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.positionVaultName ? (
                      <span className="ct-text-tertiary font-normal ml-1 text-[length:var(--ct-text-xs)]">· {tx.positionVaultName}</span>
                    ) : null}
                  </span>
                  <span className="stat-label ct-text-tertiary mono truncate opacity-70">
                    {relativeTime(tx.occurredAt, asOf)}
                  </span>
                </span>
                <span className={`pf-activity__amt tabular text-[var(--ct-text-xs)] font-semibold transition-colors group-hover/row:ct-text-accent${dir === "in" ? " ct-text-accent" : ""}`}>
                  {dir === "out" ? "−" : "+"}
                  {usdFmt.format(tx.amountUsdc)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        /* Premium zero-state — ghost rows + centered message */
        <div className="pf-activity-zero">
          <div className="pf-activity-zero__ghost" aria-hidden="true">
            {[80, 62, 74, 55, 68].map((w, i) => (
              <div key={i} className="pf-activity-zero__ghost-row">
                <span className="pf-activity-zero__ghost-icon" />
                <span className="pf-activity-zero__ghost-bar" style={{ width: `${w}%` }} />
                <span className="pf-activity-zero__ghost-amt" />
              </div>
            ))}
          </div>
          <div className="pf-activity-zero__label">
            <span className="pf-activity-zero__title">No transactions yet</span>
            <span className="pf-activity-zero__hint">Deposits, payouts and withdrawals appear here</span>
          </div>
        </div>
      )}
    </PfCockpitPanel>
  );
}
