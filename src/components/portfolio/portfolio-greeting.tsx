import { formatUsdCompact } from "@/lib/vaults/product-display";

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
      ? `${ticker.blendedLow.toFixed(1)} – ${ticker.blendedHigh.toFixed(1)}%`
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
        <p className="pf-greeting__sub m-0">Portfolio cockpit</p>
      </div>

      {ticker ? (
        <dl className="pf-ticker-inline">
          <div>
            <dt>Portfolio value</dt>
            <dd>{has ? formatUsdCompact(ticker.totalValueUsdc) : DASH}</dd>
          </div>
          <div>
            <dt>APY range</dt>
            <dd className={has ? "pf-ticker-inline__accent" : undefined}>{apyRange}</dd>
            <dd className="pf-ticker-inline__note">not guaranteed</dd>
          </div>
          <div>
            <dt>Next payout</dt>
            <dd>{nextPayout}</dd>
            {payoutDate ? <dd className="pf-ticker-inline__note">{payoutDate}</dd> : null}
          </div>
          <div>
            <dt>12M yield (fwd)</dt>
            <dd>{has ? formatUsdCompact(ticker.totalYieldYtdUsdc) : DASH}</dd>
          </div>
        </dl>
      ) : null}
    </header>
  );
}
