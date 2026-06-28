/**
 * HcMetricSparkline — inline mini line/area for KPI cards and dense rows.
 *
 * Pure SVG, no axes, no tooltip. Renders a flat empty surface when there are
 * fewer than two points so an empty series never paints a misleading trend.
 */

import { extent, project, polyline, pathD, type PlotBox } from "./geometry";
import type { HcPoint } from "./types";

export type HcSparklineTone = "accent" | "warning" | "danger";

export interface HcMetricSparklineProps {
  values: readonly number[];
  /** Internal viewBox width — the geometry coordinate space. */
  width?: number;
  /** Internal viewBox height — the geometry coordinate space. */
  height?: number;
  /** Fill the area under the curve (accent tone only). */
  area?: boolean;
  tone?: HcSparklineTone;
  /**
   * Fluid mode: the SVG fills its container (width/height 100%,
   * preserveAspectRatio="none") instead of rendering at the fixed `width`×
   * `height`. `width`/`height` then only define the viewBox math. Use inside a
   * sized parent (e.g. HcChartCard's plot slot) so the trend is responsive and
   * never overflows or leaves dead space. Default false keeps inline KPI-row
   * sparklines at their fixed pixel size.
   */
  responsive?: boolean;
  "aria-label": string;
}

const STROKE: Record<HcSparklineTone, string> = {
  accent: "var(--ct-chart-curve-color)",
  warning: "var(--ct-status-warning)",
  danger: "var(--ct-status-danger)",
};

export function HcMetricSparkline({
  values,
  width = 160,
  height = 56,
  area = true,
  tone = "accent",
  responsive = false,
  ...rest
}: HcMetricSparklineProps) {
  const ariaLabel = rest["aria-label"];

  // Fluid mode fills the parent; fixed mode keeps the pixel size.
  const svgSize = responsive
    ? ({ width: "100%", height: "100%" } as const)
    : ({ width, height } as const);

  if (values.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        style={{
          ...(responsive ? { width: "100%", height: "100%" } : { width, height }),
          borderRadius: "var(--ct-radius-sm)",
          background: "var(--ct-surface-inset)",
        }}
      />
    );
  }

  const box: PlotBox = { width, height, padX: 2, padY: 6 };
  const yDomain = extent(values);
  const xDomain: readonly [number, number] = [0, values.length - 1];
  const pts: HcPoint[] = values.map((v, i) =>
    project({ x: i, y: v }, xDomain, yDomain, box),
  );
  // Safe non-null: the `values.length < 2` guard above guarantees ≥2 points.
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const baseY = height - box.padY;
  const areaD = `${pathD(pts)} L${last.x.toFixed(2)} ${baseY.toFixed(2)} L${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      {...svgSize}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? "none" : undefined}
      style={responsive ? { display: "block" } : undefined}
    >
      {area && tone === "accent" && (
        <>
          <defs>
            <linearGradient id="hc-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
              <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#hc-spark-fill)" />
        </>
      )}
      <polyline
        points={polyline(pts)}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={3} fill={STROKE[tone]} />
    </svg>
  );
}
