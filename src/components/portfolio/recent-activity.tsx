import type { PortfolioTransaction } from "@/lib/data/portfolio";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { resolveWidgetView } from "@/lib/portfolio/view-state";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { relativeTime } from "@/lib/format/time";
import { WidgetShell } from "@/components/portfolio/widget-shell";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Investor-facing labels. Keys match DB tx.type and MUST NOT change.
const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  claim: "Claim",
  withdraw: "Withdrawal",
  distribution: "Payout",
};

// Inflow (+) vs outflow (−) direction — monochrome: the glyph carries the sign,
// not colour. Withdrawals are the only outflow.
function flowSign(type: string): "in" | "out" {
  return type === "withdraw" ? "out" : "in";
}

interface RecentActivityProps {
  transactions: PortfolioTransaction[];
  source: "live" | "fallback";
  updatedAt?: Date;
  previewZeros?: boolean;
  leafHref?: string;
}

/**
 * Recent activity — recoded from scratch. Five latest transactions as clean
 * rows: a directional glyph (▲ inflow / ▼ outflow, monochrome), the type +
 * vault, a relative time, and the amount. Honest empty state. Provenance on the
 * shell header (#2).
 */
export function RecentActivity({
  transactions,
  source,
  updatedAt,
  previewZeros = false,
  leafHref,
}: RecentActivityProps) {
  const displayed = transactions.slice(0, 5);
  const view = resolveWidgetView({
    previewZeros,
    hasData: displayed.length > 0,
    provenance: resolveProvenance(source, updatedAt),
  });
  const asOf = new Date();
  const trailing = leafHref ? <PortfolioLeafLink href={leafHref} /> : undefined;

  const zeroSlot = (
    <div className="pf-activity pf-activity--empty">
      <p className="pf-activity__empty-lead body-sm ct-text-muted m-0">No transactions yet</p>
      <p className="pf-activity__empty-hint body-xs ct-text-faint m-0">
        Deposits and payouts will appear here.
      </p>
    </div>
  );

  const liveContent = (
    <div className="pf-activity">
      {displayed.map((tx) => {
        const dir = flowSign(tx.type);
        return (
          <div key={tx.id} className="pf-activity__row">
            <span
              className="pf-activity__glyph"
              data-dir={dir}
              aria-hidden
            >
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
  );

  return (
    <WidgetShell
      variant="wide"
      ariaLabel="Recent account activity"
      title="Recent activity"
      view={view}
      trailing={trailing}
      zeroSlot={zeroSlot}
      className="h-full"
    >
      {liveContent}
    </WidgetShell>
  );
}
