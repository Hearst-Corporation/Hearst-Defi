import { formatUsdCompact } from "@/lib/format/usd-compact";

export interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
  /** Layout preview: $0 and scheduled date instead of em-dashes. */
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
    <section
      className="pf-hero-rail-group pf-hero-rail-group--metrics"
      aria-label="Key metrics summary"
    >
      <h3 className="pf-hero-rail-title">Key metrics</h3>

      <dl className="pf-hero-rail-list">
        <div className="pf-hero-rail-row">
          <dt className="stat-label">Position value</dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="dash-value tabular-nums text-2xl">
              {showValues
                ? fmt.format(previewZeros ? 0 : totalValueUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt className="stat-label">Yield YTD</dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="dash-value tabular-nums">
              {showValues
                ? formatUsdCompact(previewZeros ? 0 : totalYieldYtdUsdc)
                : "—"}
            </span>
            <span className="dash-unit">USDC</span>
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt className="stat-label">Next distribution</dt>
          <dd className="pf-hero-rail-value pf-hero-rail-value--inline m-0">
            <span className="dash-value tabular-nums">
              {showValues ? monthDayFmt.format(nextDistributionAt) : "—"}
            </span>
            {hasPositions && diffDays > 0 ? (
              <span className="pf-chip-accent shrink-0">{diffDays}d left</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
