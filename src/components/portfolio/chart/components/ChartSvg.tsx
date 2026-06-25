import type { ChartPoint } from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W, VB_H } from "@/lib/portfolio/geometry/svgConstants";

interface ChartSvgProps {
  areaPath: string;
  linePath: string;
  distributionPoints: ChartPoint[];
  hoverPoint: ChartPoint | null;
  uid: string;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave: () => void;
}

export function ChartSvg({
  areaPath,
  linePath,
  distributionPoints,
  hoverPoint,
  uid,
  onMouseMove,
  onMouseLeave,
}: ChartSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="block w-full h-full overflow-visible"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <defs>
        <linearGradient id={`${uid}-area-gradient`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
          <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      {[0.25, 0.5, 0.75].map((frac) => (
        <line
          key={frac}
          x1="0"
          y1={VB_H * frac}
          x2={VB_W}
          y2={VB_H * frac}
          stroke="var(--ct-graphite-border-nested)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.3"
        />
      ))}

      {/* Area */}
      <path
        d={areaPath}
        fill={`url(#${uid}-area-gradient)`}
        className="transition-all duration-500 ease-out"
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--ct-chart-curve-color)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
      />

      {/* Distribution Dots */}
      {distributionPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="var(--ct-bg-deep)"
          stroke="var(--ct-chart-curve-color)"
          strokeWidth="1.5"
        />
      ))}

      {/* Hover Marker */}
      {hoverPoint && (
        <g>
          <line
            x1={hoverPoint.x}
            y1="0"
            x2={hoverPoint.x}
            y2={VB_H}
            stroke="var(--ct-chart-curve-color)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r="4"
            fill="var(--ct-chart-curve-color)"
            stroke="var(--ct-bg-deep)"
            strokeWidth="2"
          />
        </g>
      )}
    </svg>
  );
}
