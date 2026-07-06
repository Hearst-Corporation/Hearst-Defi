/**
 * PositionDistributionChart — monthly distributions, realized vs projected.
 *
 * Pure SVG (HIS grammar, shared with the Value Trajectory hero). Realized months
 * = SOLID accent bars (Attested). Projected months = a graphite HATCHED low→high
 * RANGE band (Estimated) — never accent, never a single point. A cumulative-yield
 * line rides a right axis: solid-muted through paid months, dashed-muted through
 * projected months (honest-fan p50 treatment) so a forward line is never dressed
 * as guaranteed. Footer stamps methodology + APY range + "not guaranteed".
 * Server component; numbers arrive pre-computed from `buildYieldHistory`.
 */

import { METHODOLOGY_VERSION } from "@/lib/engine/methodology";
import type { YieldCumulativePoint, YieldMonth } from "@/lib/portfolio/yield-history";

const VIEW_W = 1000;
const VIEW_H = 240;
const PAD = { top: 18, right: 44, bottom: 26, left: 44 } as const;

function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  return (steps.find((s) => norm <= s) ?? 10) * mag;
}
function compactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return `$${Math.round(n)}`;
}

export function PositionDistributionChart({
  months,
  cumulative,
  showProjected,
  apyLowPct,
  apyHighPct,
  "aria-label": ariaLabel,
  height = 220,
}: {
  months: readonly YieldMonth[];
  cumulative: readonly YieldCumulativePoint[];
  showProjected: boolean;
  apyLowPct: number;
  apyHighPct: number;
  "aria-label": string;
  height?: number;
}) {
  const plotLeft = PAD.left;
  const plotRight = VIEW_W - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = VIEW_H - PAD.bottom;
  const plotH = plotBottom - plotTop;
  const plotW = plotRight - plotLeft;

  const n = Math.max(1, months.length);
  const bandW = plotW / n;
  const barW = Math.min(bandW * 0.5, 46);
  const cx = (i: number): number => plotLeft + (i + 0.5) * bandW;

  const leftMax = niceCeil(
    Math.max(
      1,
      ...months.map((mo) => mo.realizedUsdc),
      ...(showProjected ? months.map((mo) => mo.projHi) : [0]),
    ),
  );
  const rightMax = niceCeil(
    Math.max(
      1,
      ...cumulative.map((p) => p.paid ?? 0),
      ...(showProjected ? cumulative.map((p) => p.projectedMid ?? 0) : [0]),
    ),
  );
  const yL = (v: number): number => plotBottom - (v / leftMax) * plotH;
  const yR = (v: number): number => plotBottom - (v / rightMax) * plotH;

  const f2 = (x: number): string => (Number.isFinite(x) ? x : 0).toFixed(2);
  const paidLine = cumulative
    .filter((p) => p.paid !== null)
    .map((p, i) => {
      const idx = cumulative.indexOf(p);
      return `${i === 0 ? "M" : "L"}${f2(cx(idx))} ${f2(yR(p.paid ?? 0))}`;
    })
    .join(" ");
  const projLine = cumulative
    .filter((p) => p.projectedMid !== null)
    .map((p, i) => {
      const idx = cumulative.indexOf(p);
      return `${i === 0 ? "M" : "L"}${f2(cx(idx))} ${f2(yR(p.projectedMid ?? 0))}`;
    })
    .join(" ");

  const leftTicks = [0, leftMax / 2, leftMax];
  const leftPct = (x: number): string => `${(x / VIEW_W) * 100}%`;
  const topPct = (y: number): string => `${(y / VIEW_H) * 100}%`;

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="ct-bento-label">Monthly distributions</span>
        <div className="flex items-center gap-4">
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-sm bg-[var(--ct-accent)]" />
            Paid
          </span>
          {showProjected && (
            <span className="ct-metric-caption inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-sm"
                style={{ background: "var(--ct-chart-band-fill)", border: "1px solid var(--ct-chart-band-stroke)" }}
              />
              Projected range
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full" style={{ height }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          style={{ display: "block", position: "absolute", inset: 0 }}
        >
          <defs>
            <pattern id="yh-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--ct-chart-band-fill)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ct-chart-band-stroke)" strokeWidth="1" />
            </pattern>
          </defs>

          {leftTicks.map((t, i) => (
            <line
              key={i}
              x1={plotLeft}
              y1={yL(t)}
              x2={plotRight}
              y2={yL(t)}
              stroke="var(--ct-chart-grid-stroke)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Bars */}
          {months.map((mo, i) => {
            const x = cx(i) - barW / 2;
            if (mo.realizedUsdc > 0) {
              const y = yL(mo.realizedUsdc);
              return (
                <rect
                  key={`bar${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, plotBottom - y)}
                  fill="var(--ct-accent)"
                  rx={2}
                />
              );
            }
            if (showProjected && mo.status === "projected" && mo.projHi > 0) {
              const yHi = yL(mo.projHi);
              const yLo = yL(mo.projLo);
              return (
                <rect
                  key={`proj${i}`}
                  x={x}
                  y={yHi}
                  width={barW}
                  height={Math.max(2, yLo - yHi)}
                  fill="url(#yh-hatch)"
                  stroke="var(--ct-chart-band-stroke)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  rx={2}
                />
              );
            }
            return null;
          })}

          {/* Cumulative line — right axis. Paid solid-muted, projected dashed-muted. */}
          {paidLine && (
            <path
              d={paidLine}
              fill="none"
              stroke="var(--ct-chart-band-stroke)"
              strokeWidth={1.8}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {showProjected && projLine && (
            <path
              d={projLine}
              fill="none"
              stroke="var(--ct-chart-band-stroke)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Left y-axis (monthly $) */}
        {leftTicks.map((t, i) => (
          <span
            key={`yl${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 2,
              top: topPct(yL(t)),
              transform: "translateY(-50%)",
              fontSize: "var(--ct-text-nano)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--ct-text-muted)",
              pointerEvents: "none",
            }}
          >
            {compactUsd(t)}
          </span>
        ))}

        {/* Right y-axis (cumulative $) top marker */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 2,
            top: topPct(plotTop),
            transform: "translateY(-50%)",
            fontSize: "var(--ct-text-nano)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          Σ {compactUsd(rightMax)}
        </span>

        {/* X-axis month labels */}
        {months.map((mo, i) => (
          <span
            key={`x${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: leftPct(cx(i)),
              bottom: 0,
              transform: "translateX(-50%)",
              fontSize: "var(--ct-text-nano)",
              color:
                mo.status === "paid"
                  ? "var(--ct-text-secondary)"
                  : "var(--ct-text-muted)",
              pointerEvents: "none",
            }}
          >
            {mo.label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <p className="ct-metric-caption">
        Realized bars are paid distributions (Attested). Projected range ={" "}
        principal × APY {apyLowPct}–{apyHighPct}% ÷ 12, methodology {METHODOLOGY_VERSION}, net of
        fees. <span style={{ color: "var(--ct-text-muted)" }}>Not guaranteed.</span>
      </p>
    </div>
  );
}
