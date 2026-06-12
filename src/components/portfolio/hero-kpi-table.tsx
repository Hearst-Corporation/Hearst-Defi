import { formatUsdCompact } from "@/lib/format/usd-compact";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

export interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
  previewZeros?: boolean;
}

export function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
  previewZeros = false,
}: HeroKpiTableProps) {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const monthDayFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const now = new Date();
  const diffDays = Math.ceil(
    Math.max(0, nextDistributionAt.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const showValues = hasPositions || previewZeros;

  return (
    <HeroRailGroup title="Key metrics" aria-label="Key metrics summary">
      <dl className="pf-hero-rail-list">
        <div className="pf-hero-rail-row">
          <dt className="stat-label">Position value</dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="pf-hero-kpi-value tabular-nums">
              {showValues && !previewZeros
                ? fmt.format(totalValueUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt className="stat-label">Yield YTD</dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="pf-hero-kpi-value tabular-nums">
              {showValues && !previewZeros
                ? formatUsdCompact(totalYieldYtdUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt className="stat-label">Next distribution</dt>
          <dd className="pf-hero-rail-value pf-hero-rail-value--inline m-0">
            <span className="pf-hero-kpi-value tabular-nums">
              {showValues && !previewZeros
                ? monthDayFmt.format(nextDistributionAt)
                : "—"}
            </span>
            {hasPositions && diffDays > 0 ? (
              <span className="pf-chip-accent shrink-0">{diffDays}d left</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </HeroRailGroup>
  );
}
