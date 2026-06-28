"use client";

import { monthsToTarget, buildProjectionSeries } from "@/lib/projection-chart";
import type { VaultProduct } from "@/lib/data/vaults";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EmptySurface } from "@/components/ui/empty-surface";
import { formatUsdFull } from "@/lib/vaults/product-display";

interface TimeToTargetChartProps {
  amount: number; // USDC
  vault: VaultProduct;
}

const CHART_MONTHS = 24;
const TARGET_CUMULATIVE_PCT = 10; // 10% cumulative yield as "milestone"

const ACCENT = "#A7FB90";
const GRID_STROKE = "rgba(255,255,255,0.04)";

const VB_W = 300;
const VB_H = 120;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 8;
const INNER_W = VB_W - PAD_L - PAD_R;
const INNER_H = VB_H - PAD_T - PAD_B;

function xAt(i: number, total: number): number {
  if (total <= 1) return PAD_L + INNER_W / 2;
  return PAD_L + (i / (total - 1)) * INNER_W;
}

function yAt(nav: number, minNav: number, maxNav: number): number {
  const span = maxNav - minNav || 1;
  return PAD_T + INNER_H - ((nav - minNav) / span) * INNER_H;
}

function linePath(xs: number[], ys: number[]): string {
  return xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${(ys[i] ?? PAD_T).toFixed(2)}`)
    .join(" ");
}

function areaPath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return "";
  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${(ys[i] ?? PAD_T).toFixed(2)}`)
    .join(" ");
  const firstX = (xs[0] ?? PAD_L).toFixed(2);
  const lastX = (xs[xs.length - 1] ?? PAD_L + INNER_W).toFixed(2);
  const baselineY = (PAD_T + INNER_H).toFixed(2);
  return `${line} L${lastX},${baselineY} L${firstX},${baselineY} Z`;
}

/** Shared bento panel frame — matches the Portfolio chart panel exactly. */
function ChartFrame({
  title,
  children,
  ariaLabel,
}: {
  title: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between px-5 pt-5 pb-2 relative z-20 gap-4">
        <h2 className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
          {title}
        </h2>
        <ProvenanceBadge kind="estimated" />
      </div>
      <div
        className="flex-1 min-h-[200px] flex items-center justify-center relative px-2 pb-2"
        role="img"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}

export function TimeToTargetChart({ amount, vault }: TimeToTargetChartProps) {
  if (amount <= 0) {
    return (
      <div className="flex flex-col gap-3">
        <ChartFrame
          title="Projected NAV Horizon"
          ariaLabel="Projected NAV chart awaiting deposit amount"
        >
          <EmptySurface
            variant="chart"
            message="Enter a deposit amount to populate the projected NAV horizon."
            detail="The chart frame stays fixed so the preview and deposit views share the same layout."
            className="h-full justify-center"
          />
        </ChartFrame>
        <p className="text-[10px] text-zinc-500 text-center tracking-wide">
          Conditional projection — not a projection of future returns. Methodology v1.0.
        </p>
      </div>
    );
  }

  const midApy = (vault.apyLow + vault.apyHigh) / 2;
  const months10pct = monthsToTarget(midApy, TARGET_CUMULATIVE_PCT, CHART_MONTHS);

  const series = buildProjectionSeries(100, vault.apyLow, vault.apyHigh, CHART_MONTHS);
  const midPts = series.mid;
  const highPts = series.high;

  const hasData = midPts.length >= 2;

  if (!hasData) {
    return (
      <div className="flex flex-col gap-3">
        <ChartFrame
          title="Projected NAV Horizon"
          ariaLabel="No projection data available"
        >
          <EmptySurface
            variant="chart"
            message="Projection inputs are incomplete."
            detail="This chart slot remains visible and will populate once the horizon series is available."
            className="h-full justify-center"
          />
        </ChartFrame>
        <p className="text-[10px] text-zinc-500 text-center tracking-wide">
          Conditional projection — not a projection of future returns. Methodology v1.0.
        </p>
      </div>
    );
  }

  const navValues = midPts.map((p) => p.nav);
  const highValues = highPts.map((p) => p.nav);
  const allValues = [...navValues, ...highValues];
  const minNav = Math.min(...allValues);
  const maxNav = Math.max(...allValues);

  const totalPts = midPts.length;
  const xs = midPts.map((_, i) => xAt(i, totalPts));
  const ysHigh = highValues.map((v) => yAt(v, minNav, maxNav));
  const ysMid = navValues.map((v) => yAt(v, minNav, maxNav));

  // Area path for mid fill
  const midArea = areaPath(xs, ysMid);
  const midLine = linePath(xs, ysMid);

  // High line (band ceiling)
  const highLine = linePath(xs, ysHigh);

  // Band area between mid and high
  const highXs = highPts.map((_, i) => xAt(i, totalPts));
  const bandArea = (() => {
    const top = highXs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${(ysHigh[i] ?? PAD_T).toFixed(2)}`).join(" ");
    const reversed = [...xs].reverse();
    const reversedYsMid = [...ysMid].reverse();
    const bottom = reversed.map((x, i) => `L${x.toFixed(2)},${(reversedYsMid[i] ?? PAD_T + INNER_H).toFixed(2)}`).join(" ");
    return `${top} ${bottom} Z`;
  })();

  // Target milestone vertical line
  const targetX = months10pct !== null ? xAt(months10pct, totalPts) : null;

  // Label for target: USDC value at milestone month
  const targetNav = months10pct !== null ? (midPts[months10pct]?.nav ?? null) : null;
  const targetUsdcRaw = targetNav !== null && amount > 0 ? (targetNav / 100) * amount : null;
  const targetLabel =
    targetUsdcRaw !== null
      ? `Target: ${formatUsdFull(Math.round(targetUsdcRaw))} at M${months10pct ?? "—"}`
      : months10pct !== null
        ? `+${TARGET_CUMULATIVE_PCT}% at M${months10pct}`
        : null;

  // Horizontal grid lines (3 guides)
  const gridYs = [0.25, 0.5, 0.75].map((frac) => PAD_T + INNER_H * (1 - frac));

  // Month axis labels: 0, 6, 12, 18, 24
  const axisMonths = [0, 6, 12, 18, 24].filter((m) => m < totalPts);

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame title="Projected NAV Horizon">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-labelledby="tttc-title tttc-desc"
        >
          <defs>
            <linearGradient id="ttt-mid-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.15" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>

          <title id="tttc-title">
            Cumulative yield projection for {vault.name}
          </title>
          <desc id="tttc-desc">
            A line chart showing projected NAV growth over {CHART_MONTHS} months based on
            the {vault.apyLow}%–{vault.apyHigh}% APY range. A dashed vertical marker
            indicates when the +{TARGET_CUMULATIVE_PCT}% cumulative yield milestone is reached.
            These are conditional projections, not a commitment to future returns.
          </desc>

          {/* Horizontal grid lines */}
          {gridYs.map((gy, idx) => (
            <line
              key={idx}
              x1={PAD_L}
              y1={gy}
              x2={PAD_L + INNER_W}
              y2={gy}
              stroke={GRID_STROKE}
              strokeWidth="0.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              aria-hidden="true"
            />
          ))}

          {/* Band fill between mid and high */}
          <path
            d={bandArea}
            fill={ACCENT}
            fillOpacity="0.08"
            aria-hidden="true"
          />

          {/* Mid area fill — accent gradient 0.15 → 0 */}
          <path
            d={midArea}
            fill="url(#ttt-mid-gradient)"
            aria-hidden="true"
          />

          {/* High line (band ceiling) */}
          <path
            d={highLine}
            fill="none"
            stroke={ACCENT}
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
          />

          {/* Mid cumulative yield curve — accent line, strokeWidth 2 */}
          <path
            d={midLine}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Target milestone vertical dashed line */}
          {targetX !== null && (
            <>
              <line
                x1={targetX}
                y1={PAD_T}
                x2={targetX}
                y2={PAD_T + INNER_H}
                stroke={ACCENT}
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeDasharray="2,2"
                vectorEffect="non-scaling-stroke"
                aria-hidden="true"
              />
              {/* Target label */}
              {targetLabel !== null && (
                <text
                  x={Math.min(targetX + 2, VB_W - PAD_R - 40)}
                  y={PAD_T + 5}
                  fill={ACCENT}
                  className="text-[7px] font-mono"
                  aria-hidden="true"
                >
                  {targetLabel}
                </text>
              )}
            </>
          )}

          {/* Month axis labels */}
          {axisMonths.map((m) => (
            <text
              key={m}
              x={xAt(m, totalPts)}
              y={VB_H - 1}
              textAnchor="middle"
              fill="#71717a"
              className="text-[7px] font-mono"
              aria-hidden="true"
            >
              M{m}
            </text>
          ))}
        </svg>
      </ChartFrame>

      {months10pct !== null && (
        <p className="text-[10px] text-zinc-500 text-center tracking-wide">
          +{TARGET_CUMULATIVE_PCT}% cumulative yield milestone at month {months10pct}
        </p>
      )}

      <p className="text-[10px] text-zinc-500 text-center tracking-wide">
        Conditional projection — not a projection of future returns. Methodology v1.0.
      </p>
    </div>
  );
}
