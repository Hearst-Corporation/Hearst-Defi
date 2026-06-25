"use client";

/**
 * ValueChart — Reconstructed (2026-06-25, Agent 3/4 & 4/4).
 * Modern SVG Area chart with Distribution Dots.
 */
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import {
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdDetailed } from "@/lib/vaults/product-display";
import { ApyRange } from "@/components/ui/apy-range";
import { useId, useState, useMemo } from "react";
import {
  projectValueSeries,
  generateAreaPath,
  generateLinePath,
  type ChartPoint,
} from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W, VB_H } from "@/lib/portfolio/geometry/svgConstants";
import { ChartSvg } from "./chart/components/ChartSvg";
import { ValueTooltip } from "./chart/components/ValueTooltip";

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[]; // Kept for prop compatibility, but unused
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
  apyLow?: number;
  apyHigh?: number;
}

export function ValueChart({
  positions,
  totalValueUsdc,
  valueChartTransactions = [],
  source,
  updatedAt,
  embedded = false,
  apyLow,
  apyHigh,
}: ValueChartProps) {
  const uid = useId();
  const [hoverPoint, setHoverPoint] = useState<ChartPoint | null>(null);
  
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;

  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");

  const chartValue = isEmpty ? 0 : totalValueUsdc;

  // ── Data Projection ──
  const points = useMemo(() => {
    if (isEmpty) return [];
    return projectValueSeries(valueChartTransactions, totalValueUsdc, updatedAt || new Date());
  }, [valueChartTransactions, totalValueUsdc, updatedAt, isEmpty]);

  const areaPath = useMemo(() => generateAreaPath(points), [points]);
  const linePath = useMemo(() => generateLinePath(points), [points]);

  const distributionPoints = useMemo(() => points.filter((p) => p.isDistribution), [points]);

  // ── Interactivity ──
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length < 2) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;

    // Find nearest point by X
    let nearest = points[0]!;
    let minDist = Math.abs(points[0]!.x - x);

    for (const p of points) {
      const dist = Math.abs(p.x - x);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    setHoverPoint(nearest);
  };

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio value"
      className={cn("relative pf-value-chart", embedded && "pf-value-chart--hero-embedded")}
    >
      {/* ── Header ── */}
      <header className="pf-vc-header">
        <div className="pf-vc-header__left">
          {/* Row 1: title + provenance + date */}
          <div className="pf-vc-header__row1">
            <h2 className="pf-cockpit-panel__title--primary tracking-wider">Portfolio Value</h2>
            {provenance && <ProvenanceBadge kind={provenance} compact />}
            {updatedAt && (
              <span className="pf-vc-header__date hidden sm:inline">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(updatedAt)}
              </span>
            )}
          </div>
          {/* Row 2: balance + APY */}
          {!isEmpty && (
            <div className="pf-vc-header__row2">
              <div className="pf-vc-balance">
                <span className="pf-vc-balance__sym">$</span>
                <span className="pf-hero-kpi-value">
                  {formatUsdDetailed(chartValue).replace("$", "")}
                </span>
                <span className="pf-vc-balance__unit">USDC</span>
              </div>
              {apyLow !== undefined && apyHigh !== undefined && (
                <div className="pf-vc-apy">
                  <span className="pf-vc-apy__dot" aria-hidden />
                  <span className="pf-vc-apy__label">APY</span>
                  <ApyRange
                    low={apyLow}
                    high={apyHigh}
                    className="text-(length:--ct-text-sm) font-semibold text-secondary tracking-tight"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Technical Slot (Chart) ── */}
      <div className="pf-value-chart__chart-slot">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center opacity-20">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full">
              <line
                x1="0"
                y1={VB_H - 20}
                x2={VB_W}
                y2={VB_H - 20}
                stroke="var(--ct-graphite-border-nested)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
          </div>
        ) : (
          <div className="relative w-full h-full group/chart">
            <ChartSvg
              areaPath={areaPath}
              linePath={linePath}
              distributionPoints={distributionPoints}
              hoverPoint={hoverPoint}
              uid={uid}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPoint(null)}
            />

            {/* Tooltip */}
            {hoverPoint && <ValueTooltip point={hoverPoint} />}
          </div>
        )}
      </div>
    </PfCockpitPanel>
  );
}
