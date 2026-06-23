import { formatUsdCompact } from "@/lib/vaults/product-display";
import { formatApyRange } from "@/lib/format/apy";
import { cn } from "@/lib/cn";

export interface PortfolioTickerProps {
  totalValueUsdc: number;
  /** Total principal deployed (used for yield % calc). */
  deployedUsdc?: number;
  /** Realized YTD yield + accrued pending (USDC, since Jan 1 UTC). */
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
  now?: Date;
}

const monthDayYearFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DASH = "—";

/** Format pct with sign (+1.2% / -0.5%). */
function fmtDeltaPct(numerator: number, denominator: number): string {
  if (denominator === 0) return "+0.0%";
  const pct = ((numerator / denominator) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Portfolio hub header (mockup-matched): greeting + a right-aligned KPI strip.
 * Four inline metrics — Portfolio value · APY range · Next payout · YTD yield.
 * Zero-state renders honest em-dash placeholders (no fabricated numbers).
 */
export function PortfolioGreeting({ name, ticker, now }: PortfolioGreetingProps) {
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

  // Yield indicator: accrued yield % over principal
  const yieldDelta =
    has && ticker && ticker.deployedUsdc && ticker.deployedUsdc > 0
      ? fmtDeltaPct(ticker.totalValueUsdc - ticker.deployedUsdc, ticker.deployedUsdc)
      : null;

  const todayFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(now ?? new Date());

  return (
    <header className="pf-greeting">
      <div className="pf-greeting__lead min-w-0">
        <h1 className="h1 m-0">
          Welcome back, <span className="pf-greeting-name">{name}</span>
        </h1>
        <p className="pf-greeting__sub m-0">
          <span className="pf-greeting__sub-dot" />
          <span className="tracking-widest uppercase opacity-80">Portfolio cockpit</span>
          <span className="ct-text-muted px-2" aria-hidden>·</span>
          <span className="ct-text-muted tabular">{todayFmt}</span>
        </p>
      </div>

      {ticker ? (
        <dl className={cn("pf-ticker-inline", !has && "opacity-60")}>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">Portfolio value</dt>
            <dd className="pf-ticker-value tabular">{has ? formatUsdCompact(ticker.totalValueUsdc) : DASH}</dd>
            {has && yieldDelta ? (
              <dd className={cn("pf-ticker-note", yieldDelta.startsWith("+") ? "ct-text-accent" : "ct-text-tertiary")}>
                {yieldDelta} accrued
              </dd>
            ) : null}
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">APY range</dt>
            <dd className={cn("pf-ticker-value tabular", has ? "pf-status-row__value--accent" : "ct-text-strong")}>{apyRange}</dd>
            <dd className="pf-ticker-note">not guaranteed</dd>
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">Next payout</dt>
            <dd className="pf-ticker-value tabular">{nextPayout}</dd>
            {payoutDate ? <dd className="pf-ticker-note">{payoutDate}</dd> : <dd className="pf-ticker-note">Pending</dd>}
          </div>
          <div className="pf-ticker-cell">
            <dt className="pf-ticker-label">YTD yield</dt>
            <dd className="pf-ticker-value tabular">{has ? formatUsdCompact(ticker.totalYieldYtdUsdc) : DASH}</dd>
          </div>
        </dl>
      ) : null}
    </header>
  );
}
