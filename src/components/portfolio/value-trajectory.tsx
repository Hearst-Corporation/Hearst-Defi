/**
 * ValueTrajectory — Position Overview hero.
 *
 * One instrument, one shared time axis. LEFT of the "Today" divider: the
 * REALIZED value path (solid accent, Attested). RIGHT: a graphite PROJECTION
 * cone bounded by the note's estimated BTC accumulation range (low ↔ high),
 * midline muted-dashed — never accent, never green-as-guaranteed. The y-axis is
 * scaled to the data extent (HcFanChart convention) so the cone is legible — every tick is labelled
 * with its real value and the footer stamps assumptions + "not guaranteed", so
 * the zoom never reads as hype. A summary line states Now → Projected-at-maturity
 * as an explicit RANGE. Pure render (server component); numbers arrive
 * pre-computed from `projectValueTrajectory` (engine, clock-injected).
 */

import type { ValueProjection } from "@/lib/engine/value-projection";

const VIEW_W = 1000;
const VIEW_H = 260;
const PAD = { top: 20, right: 16, bottom: 26, left: 12 } as const;

function compactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export function ValueTrajectory({
  projection,
  nowValueLabel,
  startLabel,
  endLabel,
  "aria-label": ariaLabel,
  height = 240,
}: {
  projection: ValueProjection;
  /** Precise "now" value string for the summary (e.g. $998,010). */
  nowValueLabel: string;
  /** X-axis start label (subscription date). */
  startLabel: string;
  /** X-axis end label (maturity date / latest). */
  endLabel: string;
  "aria-label": string;
  height?: number;
}) {
  const { realized, forward, nowMs, nowValue, horizonMs, maturityLo, maturityHi, matured } =
    projection;

  const x0 = realized[0]?.at ?? nowMs;
  const x1 = matured ? (realized[realized.length - 1]?.at ?? nowMs) : horizonMs;

  // Y scaled to the data extent (not baselined at 0) so the cone reads.
  const allVals = [
    ...realized.map((p) => p.value),
    ...forward.map((p) => p.lo),
    ...forward.map((p) => p.hi),
    nowValue,
  ].filter(Number.isFinite);
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const range = dataMax - dataMin || Math.max(1, dataMax * 0.1);
  const yMin = Math.max(0, dataMin - range * 0.35);
  const yMax = dataMax + range * 0.25;

  const plotLeft = PAD.left;
  const plotRight = VIEW_W - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = VIEW_H - PAD.bottom;
  const plotH = plotBottom - plotTop;

  const xSpan = x1 - x0 || 1;
  const ySpan = yMax - yMin || 1;
  const xOf = (ms: number): number =>
    plotLeft + ((ms - x0) / xSpan) * (plotRight - plotLeft);
  const yOf = (v: number): number => plotBottom - ((v - yMin) / ySpan) * plotH;

  const f2 = (n: number): string => (Number.isFinite(n) ? n : 0).toFixed(2);
  const line = (pts: { x: number; y: number }[]): string =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${f2(p.x)} ${f2(p.y)}`).join(" ");

  // Realized line + area (down to plot floor).
  const realPts = realized.map((p) => ({ x: xOf(p.at), y: yOf(p.value) }));
  const realLineD = line(realPts);
  const realFirst = realPts[0];
  const realLast = realPts[realPts.length - 1];
  const realAreaD =
    realPts.length >= 2 && realFirst && realLast
      ? `${realLineD} L${f2(realLast.x)} ${f2(plotBottom)} L${f2(realFirst.x)} ${f2(plotBottom)} Z`
      : "";

  // Forward cone.
  const hiPts = forward.map((p) => ({ x: xOf(p.at), y: yOf(p.hi) }));
  const loPts = forward.map((p) => ({ x: xOf(p.at), y: yOf(p.lo) }));
  const midPts = forward.map((p) => ({ x: xOf(p.at), y: yOf(p.mid) }));
  const bandD =
    forward.length >= 2
      ? `${line(hiPts)} ${[...loPts].reverse().map((p) => `L${f2(p.x)} ${f2(p.y)}`).join(" ")} Z`
      : "";

  const yTicks = [yMax, (yMin + yMax) / 2, yMin];
  const leftPct = (x: number): string => `${(x / VIEW_W) * 100}%`;
  const topPct = (y: number): string => `${(y / VIEW_H) * 100}%`;

  const nowX = xOf(nowMs);
  const nowY = yOf(nowValue);

  return (
    <div className="flex flex-col gap-3 p-5">
      {/* Legend */}
      <div className="flex items-center justify-between gap-3">
        <span className="ct-bento-label">Reserve trajectory</span>
        <div className="flex items-center gap-4">
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-[var(--ct-accent)]" />
            To date
          </span>
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: "var(--ct-chart-band-stroke)" }}
            />
            Projected
          </span>
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
            <linearGradient id="vt-value-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
              <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => (
            <line
              key={i}
              x1={plotLeft}
              y1={yOf(t)}
              x2={plotRight}
              y2={yOf(t)}
              stroke="var(--ct-chart-grid-stroke)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Forward cone — graphite band, dashed edges + muted-dashed midline. */}
          {bandD && <path d={bandD} fill="var(--ct-chart-band-fill)" />}
          {forward.length >= 2 && (
            <>
              <path
                d={line(hiPts)}
                fill="none"
                stroke="var(--ct-chart-band-stroke)"
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={line(loPts)}
                fill="none"
                stroke="var(--ct-chart-band-stroke)"
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={line(midPts)}
                fill="none"
                stroke="var(--ct-chart-band-stroke)"
                strokeWidth={1.4}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {/* Realized — accent area + line. */}
          {realAreaD && <path d={realAreaD} fill="url(#vt-value-fill)" />}
          {realLineD && realPts.length >= 2 && (
            <path
              d={realLineD}
              fill="none"
              stroke="var(--ct-chart-curve-color)"
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Today divider */}
          {!matured && (
            <line
              x1={nowX}
              y1={plotTop}
              x2={nowX}
              y2={plotBottom}
              stroke="var(--ct-border)"
              strokeWidth={1}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Now endpoint dot */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: leftPct(nowX),
            top: topPct(nowY),
            width: 8,
            height: 8,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--ct-chart-curve-color)",
            boxShadow: "0 0 8px var(--ct-chart-curve-color)",
            pointerEvents: "none",
          }}
        />

        {/* Y-axis labels (top / mid / bottom) */}
        {yTicks.map((t, i) => (
          <span
            key={`y${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 4,
              top: topPct(yOf(t)),
              transform: "translateY(-50%)",
              fontSize: "var(--ct-text-nano)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--ct-text-muted)",
              background: "var(--ct-surface-card)",
              padding: "0 2px",
              pointerEvents: "none",
            }}
          >
            {compactUsd(t)}
          </span>
        ))}

        {/* X-axis date labels */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: leftPct(plotLeft),
            bottom: 0,
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {startLabel}
        </span>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: PAD.right,
            bottom: 0,
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {endLabel}
        </span>
      </div>

      {/* Summary line — Now → Projected-at-maturity (range) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="ct-metric-caption inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--ct-accent)]" />
          Now{" "}
          <span
            style={{
              fontWeight: 700,
              color: "var(--ct-text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {nowValueLabel}
          </span>
        </span>
        {!matured && (
          <span className="ct-metric-caption inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: "var(--ct-chart-band-stroke)" }}
            />
            Projected at delivery{" "}
            <span
              style={{
                fontWeight: 700,
                color: "var(--ct-text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {compactUsd(maturityLo)}–{compactUsd(maturityHi)}
            </span>
          </span>
        )}
      </div>

      {/* Assumptions footer */}
      <p className="ct-metric-caption">
        Projection assumes an estimated BTC accumulation range of{" "}
        {compactUsd(maturityLo)}–{compactUsd(maturityHi)} at maturity, net of fees.{" "}
        <span style={{ color: "var(--ct-text-muted)" }}>Not guaranteed.</span>
      </p>
    </div>
  );
}
