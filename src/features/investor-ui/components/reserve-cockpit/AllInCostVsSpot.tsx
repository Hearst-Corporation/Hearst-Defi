// src/features/investor-ui/components/reserve-cockpit/AllInCostVsSpot.tsx
//
// AllInCostVsSpot — the all-in BTC acquisition cost from mining vs the BTC spot
// price, month by month. When mining cost sits below spot, the program is
// accumulating BTC cheaper than buying it — the core Series 1 thesis.
//
// Pure SVG (HIS `geometry` helpers) with HTML-overlay axis labels (never shear).
// Two lines share ONE axis (both are USD/BTC), so it is a dual-SERIES chart, not
// a dual-axis one — a shared axis keeps the "cost below spot" gap honest and
// directly comparable. Null / <2 points → DataUnavailable, no fabricated lines.

import { HcSourceBadge } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";
import { pathD, polyline, project, type PlotBox } from "@/components/dataviz/his/geometry";
import type { HcPoint } from "@/components/dataviz/his/types";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

export interface CostSpotPoint {
  readonly period: string;
  /** All-in mining cost to acquire 1 BTC, in USD. */
  readonly allInCostUsd: number;
  /** BTC spot price for the same period, in USD. */
  readonly spotUsd: number;
}

export interface AllInCostVsSpotProps {
  points: readonly CostSpotPoint[] | null;
  source?: HcSourceStatus;
  height?: number;
  className?: string;
}

const VIEW_W = 1000;
const PAD = { top: 16, right: 16, bottom: 26, left: 60 } as const;

function formatUsdBtc(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function AllInCostVsSpot({
  points,
  source = "estimated",
  height = 240,
  className,
}: AllInCostVsSpotProps) {
  if (!points || points.length < 2) {
    return (
      <ReserveBlockFrame title="All-In Cost vs Spot" source={source} className={className}>
        <DataUnavailable
          label="All-in cost vs spot"
          detail="Not enough cost/spot history has resolved to draw a comparison."
        />
      </ReserveBlockFrame>
    );
  }

  const VIEW_H = height;
  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;
  const box: PlotBox = { width: plotW, height: plotH, padX: 4, padY: 6 };

  const allVals = points.flatMap((p) => [p.allInCostUsd, p.spotUsd]).filter(Number.isFinite);
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = 0;
    max = max || 1;
  }
  const pad = (max - min) * 0.1 || 1;
  const yDomain: readonly [number, number] = [Math.max(0, min - pad), max + pad];
  const xDomain: readonly [number, number] = [0, points.length - 1];

  const frame = (v: number, i: number): HcPoint => {
    const pr = project({ x: i, y: v }, xDomain, yDomain, box);
    return { x: pr.x + PAD.left, y: pr.y + PAD.top };
  };

  const costPts = points.map((p, i) => frame(p.allInCostUsd, i));
  const spotPts = points.map((p, i) => frame(p.spotUsd, i));

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_v, i) => {
    const val = yDomain[0] + ((yDomain[1] - yDomain[0]) * i) / yTickCount;
    return { val, y: frame(val, 0).y };
  });

  const xStep = Math.max(1, Math.ceil(points.length / 7));
  const xLabels = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % xStep === 0 || i === points.length - 1);

  const leftPct = (px: number): string => `${(px / VIEW_W) * 100}%`;
  const topPct = (py: number): string => `${(py / VIEW_H) * 100}%`;

  // Honest thesis cue: only assert "below" when EVERY resolved cost is under spot.
  const costBelowSpot = points.every((p) => p.allInCostUsd < p.spotUsd);

  return (
    <ReserveBlockFrame
      title="All-In Cost vs Spot"
      source={source}
      subtitle="Mining acquisition cost per BTC vs BTC spot price"
      className={className}
      footnote="Estimated cost and spot values, not guaranteed. A cost below spot indicates BTC accumulated cheaper than purchased — an observation, not a promise of future outcomes."
    >
      <div className="flex flex-col gap-[var(--ct-space-3)]">
        <div className="relative w-full" style={{ height }}>
          <svg
            role="img"
            aria-label="All-in mining cost per BTC vs BTC spot price over time"
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            style={{ display: "block", position: "absolute", inset: 0 }}
          >
            {yTicks.map(({ y }, i) => (
              <line
                key={i}
                x1={PAD.left}
                y1={y}
                x2={VIEW_W - PAD.right}
                y2={y}
                stroke="var(--ct-chart-grid-stroke)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {/* Gap wash between spot and cost (accumulation advantage). */}
            <path
              d={`${pathD(spotPts)} ${pathD([...costPts].reverse())} Z`}
              fill="var(--ct-accent)"
              opacity={0.08}
            />
            <polyline
              points={polyline(spotPts)}
              fill="none"
              stroke="var(--ct-text-muted)"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={polyline(costPts)}
              fill="none"
              stroke="var(--ct-accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {yTicks.map(({ val, y }, i) => (
            <span
              key={`y${i}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 2,
                top: topPct(y),
                transform: "translateY(-50%)",
                fontSize: "var(--ct-text-nano)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--ct-text-muted)",
                pointerEvents: "none",
              }}
            >
              {formatUsdBtc(val)}
            </span>
          ))}

          {xLabels.map(({ p, i }) => (
            <span
              key={`x${i}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: leftPct(frame(0, i).x),
                bottom: 0,
                transform: "translateX(-50%)",
                fontSize: "var(--ct-text-nano)",
                color: "var(--ct-text-muted)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {p.period}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--ct-space-4)]">
          <LegendLine color="var(--ct-accent)" label="All-in mining cost / BTC" />
          <LegendLine color="var(--ct-text-muted)" label="BTC spot price" dashed />
          {costBelowSpot ? (
            <span className="flex items-center gap-[var(--ct-space-2)]">
              <HcSourceBadge status={source} dotOnly title={`Source: ${source}`} />
              <span
                style={{
                  fontSize: "var(--ct-text-nano)",
                  color: "var(--ct-accent-strong)",
                  fontWeight: 700,
                }}
              >
                Cost below spot across resolved months
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </ReserveBlockFrame>
  );
}

function LegendLine({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-[var(--ct-space-2)]"
      style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-muted)" }}
    >
      <span
        aria-hidden="true"
        style={{ width: 16, height: 0, borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      {label}
    </span>
  );
}
