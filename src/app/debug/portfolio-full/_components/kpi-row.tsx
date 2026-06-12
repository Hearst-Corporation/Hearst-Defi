import type { PortfolioData } from "@/lib/data/portfolio";
import { cn } from "@/lib/cn";
import { formatUsdCompact } from "@/lib/format/usd-compact";

import { ProvenanceBadge, type Provenance } from "./provenance-badge";

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface KpiRowProps {
  data: PortfolioData;
}

export function PortfolioKpiRow({ data }: KpiRowProps) {
  const valueProvenance: Provenance =
    data.source === "fallback" ? "stale" : "live";
  const yieldProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";
  const distProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";

  const hasPositions = data.positions.length > 0;

  // NAV/share calculation (mock)
  const totalPrincipal = data.positions.reduce((s, p) => s + p.principalUsdc, 0);
  const shares = totalPrincipal > 0 ? totalPrincipal : 1;
  const navPerShare = data.totalValueUsdc > 0 ? data.totalValueUsdc / shares : 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <article 
        className="ct-kpi-glass flex flex-col relative min-h-36 p-6 overflow-hidden" 
        aria-label="NAV per share"
      >
        <div className="flex justify-between items-center stat-label mb-6 relative z-10">
          <span>NAV / share</span>
          <ProvenanceBadge kind={valueProvenance} />
        </div>
        <div className="flex items-baseline mt-auto relative z-10">
          <span className="mono stat-value font-light text-(--ct-text-strong) tracking-tighter leading-tight tabular-nums truncate">
            {navPerShare.toFixed(4)}
          </span>
          <span className="body-xs uppercase tracking-widest opacity-50 ml-1.5">USDC</span>
        </div>
        <div className="mt-2 h-4 relative z-10">
          <p className="body-xs text-(--ct-text-muted) mono uppercase tracking-wider leading-4 truncate opacity-70">
            Par $1.00 · class A
          </p>
        </div>
      </article>

      <article 
        className="ct-kpi-glass flex flex-col relative min-h-36 p-6 overflow-hidden" 
        aria-label="Portfolio value"
      >
        <div className="flex justify-between items-center stat-label mb-6 relative z-10">
          <span>Portfolio Value</span>
          <ProvenanceBadge kind={valueProvenance} />
        </div>
        <div className="flex items-baseline mt-auto relative z-10">
          <span className="mono stat-value font-light text-(--ct-text-strong) tracking-tighter leading-tight tabular-nums truncate">
            {hasPositions ? formatUsdCompact(data.totalValueUsdc) : <span className="opacity-30">—</span>}
          </span>
          <span className="body-xs uppercase tracking-widest opacity-50 ml-1.5">USDC</span>
        </div>
        <div className="mt-2 h-4 relative z-10">
          {hasPositions && data.pnl ? (
            <p
              className={cn(
                "body-xs mono leading-4 uppercase tracking-wider",
                data.pnl.netReturnPct >= 0
                  ? "text-(--ct-accent)"
                  : "text-(--ct-status-danger)",
              )}
            >
              {data.pnl.netReturnPct >= 0 ? "+" : ""}
              {data.pnl.netReturnPct.toFixed(1)}% net return
            </p>
          ) : null}
        </div>
      </article>

      <article 
        className="ct-kpi-glass flex flex-col relative min-h-36 p-6 overflow-hidden" 
        aria-label="Yield year to date"
      >
        <div className="flex justify-between items-center stat-label mb-6 relative z-10">
          <span>Yield YTD</span>
          <ProvenanceBadge kind={yieldProvenance} />
        </div>
        <div className="flex items-baseline mt-auto relative z-10">
          <span className="mono stat-value font-light text-(--ct-text-strong) tracking-tighter leading-tight tabular-nums truncate">
            {hasPositions ? formatUsdCompact(data.totalYieldYtdUsdc) : <span className="opacity-30">—</span>}
          </span>
          <span className="body-xs uppercase tracking-widest opacity-50 ml-1.5">USDC</span>
        </div>
        <div className="mt-2 h-4 relative z-10">
          <p className="body-xs text-(--ct-text-muted) mono uppercase tracking-wider leading-4 truncate opacity-70">
            Accrued + distributed
          </p>
        </div>
      </article>

      <article 
        className="ct-kpi-glass flex flex-col relative min-h-36 p-6 overflow-hidden" 
        aria-label="Next distribution date"
      >
        <div className="flex justify-between items-center stat-label mb-6 relative z-10">
          <span>Next Distribution</span>
          <ProvenanceBadge kind={distProvenance} />
        </div>
        <div className="flex items-baseline mt-auto relative z-10">
          <span className="mono stat-value font-light text-(--ct-text-strong) tracking-tighter leading-tight tabular-nums truncate">
            {monthDayFmt.format(data.nextDistributionAt)}
          </span>
        </div>
        <div className="mt-2 h-4 relative z-10">
          <p className="body-xs text-(--ct-text-muted) mono uppercase tracking-wider leading-4 truncate opacity-70">
            Monthly · Day 1, T+5
          </p>
        </div>
      </article>
    </div>
  );
}
