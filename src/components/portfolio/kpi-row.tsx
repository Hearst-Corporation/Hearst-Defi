import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
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
  loading?: boolean;
}

/**
 * Three KPI cards: Portfolio Value · Yield YTD · Next Distribution.
 * ProvenanceBadge on each metric (CLAUDE.md non-negotiable #2).
 */
export function PortfolioKpiRow({ data, loading = false }: KpiRowProps) {
  if (loading) {
    return (
      <div className="pf-kpi-grid" role="list" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card-premium" role="listitem">
            <Skeleton variant="text" className="w-1/3 h-3 mb-[var(--ct-space-3)]" />
            <Skeleton variant="rect" className="w-1/2 h-8 mb-[var(--ct-space-2)]" />
            <Skeleton variant="text" className="w-2/3 h-3" />
          </Card>
        ))}
      </div>
    );
  }

  const valueProvenance: Provenance =
    data.source === "fallback" ? "stale" : "live";
  const yieldProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";
  const distProvenance: Provenance =
    data.source === "fallback" ? "stale" : "estimated";

  const hasPositions = data.positions.length > 0;

  return (
    <div className="pf-kpi-grid" role="list">
      {/* Portfolio Value */}
      <Card className="card-premium" role="listitem" aria-label="Portfolio value">
        <div className="pf-widget-header">
          <h3 className="h3">Portfolio Value</h3>
          <ProvenanceBadge kind={valueProvenance} variant="strip" />
        </div>
        <div className="pf-kpi-value-row">
          <span className="stat-value">
            {hasPositions ? formatUsdCompact(data.totalValueUsdc) : "—"}
          </span>
          <span className="pf-kpi-unit">USDC</span>
        </div>
        {hasPositions && data.pnl ? (
          <p
            className={cn(
              "body-xs mt-[var(--ct-space-2)] tabular",
              data.pnl.netReturnPct >= 0
                ? "ct-status-success"
                : "ct-status-danger",
            )}
          >
            {data.pnl.netReturnPct >= 0 ? "+" : ""}
            {data.pnl.netReturnPct.toFixed(1)}% net return
          </p>
        ) : null}
      </Card>

      {/* Yield YTD */}
      <Card className="card-premium" role="listitem" aria-label="Yield year to date">
        <div className="pf-widget-header">
          <h3 className="h3">Yield YTD</h3>
          <ProvenanceBadge kind={yieldProvenance} variant="strip" />
        </div>
        <div className="pf-kpi-value-row">
          <span className="stat-value">
            {hasPositions ? formatUsdCompact(data.totalYieldYtdUsdc) : "—"}
          </span>
          <span className="pf-kpi-unit">USDC</span>
        </div>
        <p className="body-xs ct-text-muted mt-[var(--ct-space-2)] italic">
          Accrued + distributed. Not projected forward.
        </p>
      </Card>

      {/* Next Distribution */}
      <Card className="card-premium" role="listitem" aria-label="Next distribution date">
        <div className="pf-widget-header">
          <h3 className="h3">Next Distribution</h3>
          <ProvenanceBadge kind={distProvenance} variant="strip" />
        </div>
        <div className="pf-kpi-value-row">
          <span className="stat-value tabular">
            {monthDayFmt.format(data.nextDistributionAt)}
          </span>
        </div>
        <p className="body-xs ct-text-muted mt-[var(--ct-space-2)]">
          Monthly cadence · Day 1, T+5
        </p>
      </Card>
    </div>
  );
}
