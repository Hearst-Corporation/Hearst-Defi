/**
 * HcFanChart — p5 / p50 / p95 projection fan.
 *
 * The p5–p95 band is info-tinted (never green, never "guaranteed"); p50 is the
 * accent median line; p5/p95 edges are dotted. When a seed is provided the chart
 * stamps it alongside an explicit "not guaranteed" note so a seeded projection
 * is never mistaken for a promise. No business math — bands are pre-computed.
 */

import { extent, project, polyline, pathD, type PlotBox } from "./geometry";
import { HcPlotEmpty } from "./HcPlotEmpty";
import type { HcPoint } from "./types";

export interface HcFanBand {
  /** Horizon position (e.g. month index). */
  m: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface HcFanChartProps {
  bands: readonly HcFanBand[];
  width?: number;
  height?: number;
  /** Display unit, e.g. "%" or "USDC". */
  unit?: string;
  /** When set, makes the projection's reproducibility explicit. */
  seedLabel?: string;
  /** Empty-state message when fewer than 2 bands (required for a11y). */
  emptyMessage?: string;
  "aria-label": string;
}

export function HcFanChart({
  bands,
  width = 560,
  height = 320,
  unit = "%",
  seedLabel,
  emptyMessage = "No projection data yet",
  ...rest
}: HcFanChartProps) {
  const ariaLabel = rest["aria-label"];

  if (bands.length < 2) {
    return (
      <HcPlotEmpty message={emptyMessage} height={height} aria-label={ariaLabel} />
    );
  }

  const box: PlotBox = { width, height, padX: 40, padY: 16 };
  const first = bands[0]!;
  const lastBand = bands[bands.length - 1]!;
  const xDomain: readonly [number, number] = [first.m, lastBand.m];
  const yDomain = extent(bands.flatMap((b) => [b.p5, b.p95]));

  const upper: HcPoint[] = bands.map((b) => project({ x: b.m, y: b.p95 }, xDomain, yDomain, box));
  const lower: HcPoint[] = bands.map((b) => project({ x: b.m, y: b.p5 }, xDomain, yDomain, box));
  const median: HcPoint[] = bands.map((b) => project({ x: b.m, y: b.p50 }, xDomain, yDomain, box));

  const lowerReversed = [...lower].reverse();
  const bandPath = `${pathD(upper)} ${lowerReversed
    .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")} Z`;

  const yTicks = [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];
  const unitSuffix = unit === "%" ? "%" : "";

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {yTicks.map((t, i) => {
        const y = project({ x: xDomain[0], y: t }, xDomain, yDomain, box).y;
        return (
          <g key={i}>
            <line
              x1={box.padX}
              y1={y}
              x2={width - box.padX}
              y2={y}
              stroke="var(--ct-border-soft)"
              strokeWidth={1}
              opacity="var(--ct-opacity-8)"
            />
            <text
              x={box.padX - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--ct-text-muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.toFixed(1)}
              {unitSuffix}
            </text>
          </g>
        );
      })}

      {/* p5–p95 band — info-tinted, never accent. */}
      <path
        d={bandPath}
        fill="var(--ct-chart-band-fill)"
        stroke="var(--ct-chart-band-stroke)"
        strokeWidth={1}
        data-hc-band="p5-p95"
      />
      <polyline
        points={polyline(upper)}
        fill="none"
        stroke="var(--ct-chart-band-stroke)"
        strokeWidth={1}
        strokeDasharray="3 3"
        data-hc-line="p95"
      />
      <polyline
        points={polyline(lower)}
        fill="none"
        stroke="var(--ct-chart-band-stroke)"
        strokeWidth={1}
        strokeDasharray="3 3"
        data-hc-line="p5"
      />
      {/* p50 median — accent. */}
      <polyline
        points={polyline(median)}
        fill="none"
        stroke="var(--ct-chart-curve-color)"
        strokeWidth={2.2}
        strokeLinejoin="round"
        data-hc-line="p50"
      />

      <text
        x={width - box.padX}
        y={height - 4}
        textAnchor="end"
        fontSize={9}
        fill="var(--ct-text-faint)"
      >
        {seedLabel ? `seed: ${seedLabel} · ` : ""}p5/p50/p95 · not guaranteed
      </text>
    </svg>
  );
}
