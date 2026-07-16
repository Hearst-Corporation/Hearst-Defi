// AccumulationChart — primary dashboard chart: actual BTC accumulated over time.
// Shows accumulation history + mining credits only (no performance ranges).

import { cn } from "@/lib/cn";
import Link from "next/link";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

export interface AccumulationPoint {
  readonly period: string;
  readonly cumulativeBtc: number;
  readonly miningBtc: number;
}

interface AccumulationChartProps {
  points: readonly AccumulationPoint[];
  currentMonth: number | null;
  totalMonths: number | null;
  provenance: Provenance;
  className?: string;
}

const W = 640;
const H = 200;
const PAD = { t: 16, r: 16, b: 28, l: 48 };

export function AccumulationChart({
  points,
  currentMonth,
  totalMonths,
  provenance,
  className,
}: AccumulationChartProps) {
  if (points.length < 2) {
    return (
      <div className={cn("iw-surface-primary p-[var(--ct-space-5)]", className)}>
        <span className="stat-label ct-text-muted">BTC accumulation</span>
        <p className="body-sm ct-text-muted mt-[var(--ct-space-3)] m-0">
          Accumulation history will appear once mining credits are indexed.
        </p>
      </div>
    );
  }

  const maxBtc = Math.max(...points.map((p) => p.cumulativeBtc), 0.001);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const toX = (i: number) => PAD.l + (i / (points.length - 1)) * innerW;
  const toY = (v: number) => PAD.t + innerH - (v / maxBtc) * innerH;

  const actualPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.cumulativeBtc)}`).join(" ");
  const miningPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.miningBtc)}`).join(" ");
  const areaPath = `${actualPath} L ${toX(points.length - 1)} ${PAD.t + innerH} L ${toX(0)} ${PAD.t + innerH} Z`;

  const termLabel =
    currentMonth != null && totalMonths != null
      ? `Month ${currentMonth} of ${totalMonths}`
      : null;

  return (
    <div className={cn("iw-surface-primary flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">BTC accumulation</span>
          {termLabel ? <span className="body-xs ct-text-faint">{termLabel}</span> : null}
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
            View Bitcoin →
          </Link>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      <svg className="iw-accum-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="BTC accumulation over time">
        <path d={areaPath} className="iw-accum-chart__area" />
        <path d={miningPath} className="iw-accum-chart__line-mining" />
        <path d={actualPath} className="iw-accum-chart__line-actual" />
        {points.map((p, i) => (
          <g key={p.period}>
            <circle cx={toX(i)} cy={toY(p.cumulativeBtc)} r={3} fill="var(--ct-text-strong)" />
            <text
              x={toX(i)}
              y={H - 6}
              textAnchor="middle"
              fill="var(--ct-text-faint)"
              fontSize="9"
              fontFamily="var(--font-sans, inherit)"
            >
              {p.period.slice(5)}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-[var(--ct-space-4)] body-xs ct-text-muted">
        <span className="flex items-center gap-[var(--ct-space-1)]">
          <span className="inline-block h-0.5 w-4 bg-[var(--ct-text-strong)]" />
          Actual BTC accumulated
        </span>
        <span className="flex items-center gap-[var(--ct-space-1)]">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-[var(--ct-accent)]" />
          Mining-produced BTC
        </span>
      </div>
      <p className="body-xs ct-text-faint m-0">
        Historical accumulation only — maturity target is product-defined, not guaranteed.
      </p>
    </div>
  );
}
