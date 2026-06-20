import { formatUsdCompact } from "@/lib/vaults/product-display";
import { formatApyRange } from "@/lib/format/apy";
import { cn } from "@/lib/cn";

export interface PortfolioTickerProps {
  totalValueUsdc: number;
  /** 12-month forward yield projection (USDC). */
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  /** Next payout amount (USDC) — projected for the coming distribution. */
  nextPayoutUsdc?: number;
  blendedLow: number;
  blendedHigh: number;
  hasPositions: boolean;
}

interface PortfolioGreetingProps {
  name: string;
  ticker?: PortfolioTickerProps;
}

const monthDayYearFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DASH = "—";

/**
 * Portfolio hub header (mockup-matched): greeting + a right-aligned KPI strip.
 * Four inline metrics — Portfolio value · APY range · Next payout · 12M yield (fwd).
 * Zero-state renders honest em-dash placeholders (no fabricated numbers).
 */
export function PortfolioGreeting({ name, ticker }: PortfolioGreetingProps) {
  const has = !!ticker?.hasPositions;
  const apyRange =
    has && ticker && ticker.blendedLow + ticker.blendedHigh > 0
      ? formatApyRange({ low: ticker.blendedLow, high: ticker.blendedHigh }, 1, { spaced: true })
      : DASH;
  const payoutDate = has && ticker ? monthDayYearFmt.format(ticker.nextDistributionAt) : null;
  const nextPayout =
    has && ticker?.nextPayoutUsdc != null && ticker.nextPayoutUsdc > 0
      ? formatUsdCompact(ticker.nextPayoutUsdc)
      : DASH;

  return (
    <header className="pf-greeting">
      <div className="pf-greeting__lead min-w-0">
        <h1 className="h1 m-0">
          Welcome back, <span className="pf-greeting-name">{name}</span>
        </h1>
        <p className="pf-greeting__sub m-0">
          <span className="pf-greeting__sub-dot" />
          Portfolio cockpit
        </p>
      </div>

      {ticker ? (
        <dl className="pf-ticker-inline">
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">Portfolio value</dt>
            <dd className="pf-ticker-value tabular">{has ? formatUsdCompact(ticker.totalValueUsdc) : DASH}</dd>
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">APY range</dt>
            <dd className={cn("pf-ticker-value tabular", has && "ct-text-accent")}>{apyRange}</dd>
            <dd className="pf-ticker-note">not guaranteed</dd>
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">Next payout</dt>
            <dd className="pf-ticker-value tabular">{nextPayout}</dd>
            {payoutDate ? <dd className="pf-ticker-note">{payoutDate}</dd> : null}
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">12M yield (fwd)</dt>
            <dd className="pf-ticker-value tabular">{has ? formatUsdCompact(ticker.totalYieldYtdUsdc) : DASH}</dd>
          </div>
        </dl>
      ) : null}
    </header>
  );
}
