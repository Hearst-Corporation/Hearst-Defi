import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

export interface HeroKpiTableProps {
  totalValueUsdc: number;
  totalYieldYtdUsdc: number;
  nextDistributionAt: Date;
  hasPositions: boolean;
  source: "live" | "fallback";
  updatedAt?: Date;
  previewZeros?: boolean;
}

function metricProvenance(
  showZeroShell: boolean,
  source: "live" | "fallback",
  updatedAt: Date | undefined,
  preferred: Provenance,
): Provenance | undefined {
  if (showZeroShell) return undefined;
  return resolveProvenance(source, updatedAt, preferred);
}

export function HeroKpiTable({
  totalValueUsdc,
  totalYieldYtdUsdc,
  nextDistributionAt,
  hasPositions,
  source,
  updatedAt,
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

  const showZeroShell = previewZeros || !hasPositions;
  const showValues = hasPositions || previewZeros;
  const valueProvenance = metricProvenance(showZeroShell, source, updatedAt, "live");
  const yieldProvenance = metricProvenance(showZeroShell, source, updatedAt, "estimated");
  const distProvenance = metricProvenance(showZeroShell, source, updatedAt, "estimated");

  return (
    <HeroRailGroup title="Key metrics" aria-label="Key metrics summary">
      <dl className="pf-hero-rail-list">
        <div className="pf-hero-rail-row">
          <dt
            className={cn(
              "stat-label",
              "pf-inline-row pf-inline-row--between pf-inline-row--baseline",
            )}
          >
            <span>Position value</span>
            {valueProvenance ? (
              <ProvenanceBadge kind={valueProvenance} variant="strip" compact />
            ) : null}
          </dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="pf-hero-kpi-value tabular-nums">
              {showValues && !previewZeros
                ? fmt.format(totalValueUsdc)
                : "—"}
            </span>
            {showValues && !previewZeros ? (
              <span className="pf-kpi-unit">USDC</span>
            ) : null}
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt
            className={cn(
              "stat-label",
              "pf-inline-row pf-inline-row--between pf-inline-row--baseline",
            )}
          >
            <span>Yield YTD</span>
            {yieldProvenance ? (
              <ProvenanceBadge kind={yieldProvenance} variant="strip" compact />
            ) : null}
          </dt>
          <dd className="pf-hero-rail-value m-0">
            <span className="pf-hero-kpi-value tabular-nums">
              {showValues && !previewZeros
                ? formatUsdCompact(totalYieldYtdUsdc)
                : "—"}
            </span>
            {showValues && !previewZeros ? (
              <span className="pf-kpi-unit">USDC</span>
            ) : null}
          </dd>
        </div>

        <div className="pf-hero-rail-row">
          <dt
            className={cn(
              "stat-label",
              "pf-inline-row pf-inline-row--between pf-inline-row--baseline",
            )}
          >
            <span>Next distribution</span>
            {distProvenance ? (
              <ProvenanceBadge kind={distProvenance} variant="strip" compact />
            ) : null}
          </dt>
          <dd
            className={cn(
              "pf-hero-rail-value m-0",
              hasPositions && diffDays > 0 && "pf-hero-rail-value--inline",
            )}
          >
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
