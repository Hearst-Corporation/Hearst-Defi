import { formatUsdDetailed } from "@/lib/vaults/product-display";
import type { ChartPoint } from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W, VB_H } from "@/lib/portfolio/geometry/svgConstants";

interface ValueTooltipProps {
  point: ChartPoint;
}

export function ValueTooltip({ point }: ValueTooltipProps) {
  return (
    <div
      className="pf-vc-tooltip"
      style={{
        left: `${(point.x / VB_W) * 100}%`,
        top: `${(point.y / VB_H) * 100}%`,
        transform: `translate(${
          point.x > VB_W * 0.8 ? "-100%" : point.x < VB_W * 0.2 ? "0%" : "-50%"
        }, -120%)`,
      }}
    >
      <div className="pf-vc-tooltip__content">
        <span className="pf-vc-tooltip__value tabular-nums">
          {formatUsdDetailed(point.value)}
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="pf-vc-tooltip__date">
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
            }).format(point.date)}
          </span>
          {point.isDistribution && (
            <span className="text-(length:--ct-text-micro) text-accent font-bold uppercase tracking-widest">
              Yield
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
