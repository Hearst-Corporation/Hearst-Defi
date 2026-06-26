import { cn } from "@/lib/cn";
import { formatUsdDetailed } from "@/lib/vaults/product-display";
import type { ChartPoint } from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W, VB_H } from "@/lib/portfolio/geometry/svgConstants";

interface ValueTooltipProps {
  point: ChartPoint;
}

function tooltipEdgeClass(point: ChartPoint): string {
  const xFrac = point.x / VB_W;
  if (xFrac > 0.78) return "pf-vc-tooltip--edge-right";
  if (xFrac < 0.22) return "pf-vc-tooltip--edge-left";
  return "pf-vc-tooltip--edge-center";
}

export function ValueTooltip({ point }: ValueTooltipProps) {
  const yPct = (point.y / VB_H) * 100;
  const edgeClass = tooltipEdgeClass(point);
  const clipTop = yPct < 22;
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(point.date);

  return (
    <div
      className={cn("pf-vc-tooltip", edgeClass, clipTop && "pf-vc-tooltip--clip-top")}
      style={{
        left: `${(point.x / VB_W) * 100}%`,
        top: `${yPct}%`,
      }}
    >
      <div className="pf-vc-tooltip__content">
        <span className="pf-vc-tooltip__value tabular-nums">
          {formatUsdDetailed(point.value)}
        </span>
        <span className="pf-vc-tooltip__date">{formattedDate}</span>
        {point.isDistribution ? (
          <div className="pf-vc-tooltip__row">
            <span className="pf-vc-tooltip__badge">Distribution</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
