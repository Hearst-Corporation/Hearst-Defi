import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import type { PortfolioData } from "@/lib/data/portfolio";
import { cn } from "@/lib/cn";
import { formatUsdCompact } from "@/lib/vaults/product-display";

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface KpiRowProps {
  data: PortfolioData;
}

/**
 * Three KPI cards: Portfolio Value · Yield YTD · Next Distribution.
 * ProvenanceBadge on each metric (CLAUDE.md non-negotiable #2).
 */
export function PortfolioKpiRow({ data }: KpiRowProps) {
  const valueProvenance: Provenance =
    data.source === "fallback" ? "stale" : "live";
  const yieldProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";
  const distProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";

  const hasPositions = data.positions.length > 0;

  return (
    <div className="pf-kpi-grid">
      {/* Portfolio Value */}
      <article className="dash-cell dash-cell-premium" aria-label="Portfolio value">
        <div className="pf-widget-header">
          <h3 className="h3">Portfolio Value</h3>
          <ProvenanceBadge kind={valueProvenance} variant="strip" />
        </div>
        <div className="dash-value-group">
          <span className="stat-value">
            {hasPositions ? formatUsdCompact(data.totalValueUsdc) : "—"}
          </span>
          <span className="dash-unit">USDC</span>
        </div>
        {hasPositions && data.pnl ? (
          <p
            className={cn(
              "body-xs mt-2 tabular",
              data.pnl.netReturnPct >= 0
                ? "ct-status-success"
                : "ct-status-danger",
            )}
          >
            {data.pnl.netReturnPct >= 0 ? "+" : ""}
            {data.pnl.netReturnPct.toFixed(1)}% net return
          </p>
        ) : null}
      </article>

      {/* Yield YTD */}
      <article className="dash-cell dash-cell-premium" aria-label="Yield year to date">
        <div className="pf-widget-header">
          <h3 className="h3">Yield YTD</h3>
          <ProvenanceBadge kind={yieldProvenance} variant="strip" />
        </div>
        <div className="dash-value-group">
          <span className="stat-value">
            {hasPositions ? formatUsdCompact(data.totalYieldYtdUsdc) : "—"}
          </span>
          <span className="dash-unit">USDC</span>
        </div>
        <p className="body-xs ct-text-muted mt-2 italic">
          Accrued + distributed. Not projected forward.
        </p>
      </article>

      {/* Next Distribution */}
      <article className="dash-cell dash-cell-premium" aria-label="Next distribution date">
        <div className="pf-widget-header">
          <h3 className="h3">Next Distribution</h3>
          <ProvenanceBadge kind={distProvenance} variant="strip" />
        </div>
        <div className="dash-value-group">
          <span className="stat-value tabular">
            {monthDayFmt.format(data.nextDistributionAt)}
          </span>
        </div>
        <p className="body-xs ct-text-muted mt-2">
          Monthly cadence · Day 1, T+5
        </p>
      </article>
    </div>
  );
}
