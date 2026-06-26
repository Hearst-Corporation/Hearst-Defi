import type {
  ChartAxisTick,
  ChartPoint,
  ChartValueTick,
} from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W, VB_H, PAD_Y_TOP, CHART_BASELINE_Y } from "@/lib/portfolio/geometry/svgConstants";

interface ChartSvgProps {
  areaPath: string;
  linePath: string;
  distributionPoints: ChartPoint[];
  hoverPoint: ChartPoint | null;
  lastPoint: ChartPoint | null;
  xTicks: ChartAxisTick[];
  yTicks: ChartValueTick[];
  uid: string;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave: () => void;
}

export function ChartSvg({
  areaPath,
  linePath,
  distributionPoints,
  hoverPoint,
  lastPoint,
  xTicks,
  yTicks,
  uid,
  onMouseMove,
  onMouseLeave,
}: ChartSvgProps) {
  const showEndcap =
    lastPoint != null &&
    (hoverPoint == null ||
      Math.abs(hoverPoint.x - lastPoint.x) > 2 ||
      Math.abs(hoverPoint.y - lastPoint.y) > 2);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="block h-full w-full pf-vc-svg"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-area-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-chart-area-top)" stopOpacity="0.85" />
          <stop offset="45%" stopColor="var(--ct-chart-area-bottom)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-plot-clip`}>
          <rect x={0} y={PAD_Y_TOP - 2} width={VB_W} height={CHART_BASELINE_Y - PAD_Y_TOP + 4} />
        </clipPath>
      </defs>

      {yTicks.map((tick) => (
        <line
          key={tick.y}
          x1={0}
          y1={tick.y}
          x2={VB_W}
          y2={tick.y}
          className="pf-vc-grid"
        />
      ))}

      <g clipPath={`url(#${uid}-plot-clip)`}>
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${uid}-area-gradient)`}
            className="pf-vc-area"
          />
        )}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--ct-chart-curve-color)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="pf-vc-line"
            data-role="line"
          />
        )}
      </g>

      {distributionPoints.map((p, i) => (
        <circle
          key={`dist-${i}`}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="var(--ct-bg-deep)"
          stroke="var(--ct-chart-curve-color)"
          strokeWidth="1.25"
          className="pf-vc-dist-marker"
        />
      ))}

      {showEndcap && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3.25"
          fill="var(--ct-chart-curve-color)"
          stroke="var(--ct-bg-deep)"
          strokeWidth="1.75"
          className="pf-vc-endcap"
        />
      )}

      {hoverPoint && (
        <g className="pf-vc-hover">
          <line
            x1={hoverPoint.x}
            y1={PAD_Y_TOP}
            x2={hoverPoint.x}
            y2={CHART_BASELINE_Y}
            className="pf-vc-hover-line"
          />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r="4"
            fill="var(--ct-chart-curve-color)"
            stroke="var(--ct-bg-deep)"
            strokeWidth="2"
            className="pf-vc-hover-dot"
          />
        </g>
      )}

      {xTicks.map((tick) => (
        <text
          key={`x-${tick.x}`}
          x={tick.x}
          y={VB_H - 4}
          textAnchor="middle"
          className="pf-vc-axis-label pf-vc-axis-label--x"
        >
          {tick.label}
        </text>
      ))}

      {yTicks.map((tick) => (
        <text
          key={`y-${tick.y}`}
          x={6}
          y={tick.y + 3.5}
          textAnchor="start"
          className="pf-vc-axis-label pf-vc-axis-label--y"
        >
          {tick.label}
        </text>
      ))}
    </svg>
  );
}
