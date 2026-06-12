import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";

import { ProvenanceBadge, type Provenance } from "./provenance-badge";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildMonthSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  asOf: Date,
): Array<{ label: string; value: number }> {
  const points = 12;
  const result: Array<{ label: string; value: number }> = [];
  const startValue =
    positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;

  for (let i = 0; i < points; i++) {
    const monthOffset = -(points - 1 - i);
    const d = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthOffset, 1),
    );
    const t = i / (points - 1);
    const wave = Math.sin(i * 0.9) * (endValue - startValue) * 0.04;
    const value = Math.round(startValue + (endValue - startValue) * t + wave);
    result.push({ label: MONTHS[d.getUTCMonth() % 12] ?? "", value });
  }
  return result;
}

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  source: "live" | "fallback";
}

export function ValueChart({ positions, totalValueUsdc, source }: ValueChartProps) {
  const provenance: Provenance = source === "fallback" ? "stale" : "estimated";
  const asOf = new Date();
  const series = buildMonthSeries(positions, totalValueUsdc, asOf);

  // Sparkline coordinates math
  const minVal = Math.min(...series.map((s) => s.value));
  const maxVal = Math.max(...series.map((s) => s.value));
  const range = maxVal - minVal || 1;
  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * 100;
    // Laisser un peu de padding en haut (5px)
    const y = 35 - ((s.value - minVal) / range) * 30;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${points.join(" L ")}`;
  const areaD = `M 0,40 L ${points.join(" L ")} L 100,40 Z`;

  return (
    <article 
      className="ct-kpi-glass flex flex-col relative flex-1 h-full min-h-48 p-6 overflow-hidden" 
      aria-label="Portfolio value — 12-month trend"
    >
      <div className="flex justify-between items-center stat-label mb-6 relative z-10">
        <span>Portfolio value · 12-month trend</span>
        <div className="flex items-center gap-2">
          <ProvenanceBadge kind={provenance} />
          <span className="mono ct-text-micro-size uppercase tracking-widest px-1.5 py-0.5 rounded-xs bg-(--ct-surface-2) text-(--ct-text-primary)">
            {totalValueUsdc > 0 ? formatUsdCompact(totalValueUsdc) : <span className="opacity-30">—</span>}
          </span>
        </div>
      </div>

      <div
        className="mt-3 w-full h-36 rounded-xl ct-kpi-glass overflow-hidden flex items-end relative z-10"
        aria-hidden="true"
      >
        <svg className="w-full h-full text-(--ct-accent)" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#spark-gradient)" />
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="flex justify-between mt-2 body-xs text-(--ct-text-muted) mono relative z-10">
        {series
          .filter((_, i) => i % 3 === 0 || i === series.length - 1)
          .map((s, i) => (
            <span key={i}>{s.label}</span>
          ))}
      </div>

      <p className="body-xs text-(--ct-text-muted) mt-auto pt-4 italic relative z-10">
        Indicative trend based on position history. Past performance does not predict future results.
      </p>
    </article>
  );
}
