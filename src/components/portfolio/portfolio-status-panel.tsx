import {
  ShieldCheck,
} from "lucide-react";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";

const DASH = "—";


export interface PortfolioStatusPanelProps {
  hasPositions: boolean;
  positionsCount: number;
  deployedUsdc: number;
  totalValueUsdc: number;
  accruedYieldUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
}

export function PortfolioStatusPanel({
  hasPositions,
  positionsCount,
  deployedUsdc,
  totalValueUsdc,
  accruedYieldUsdc,
  source,
  updatedAt: _updatedAt,
  embedded = false,
}: PortfolioStatusPanelProps) {
  const deploymentPct =
    hasPositions && totalValueUsdc > 0
      ? Math.min(100, (deployedUsdc / totalValueUsdc) * 100)
      : 0;

  const isLive = hasPositions && source === "live";

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel !p-0 flex flex-col"
    >
      <div className="flex-1 p-(--ct-space-6) flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-x-(--ct-space-6) gap-y-(--ct-space-8)">
          <div className="flex flex-col gap-(--ct-space-1_5)">
            <span className="stat-label ct-text-muted border-b border-dotted border-(--ct-border-soft) w-fit">Principal</span>
            <span className="stat-value ct-text-strong tabular text-(length:--ct-text-lg)">
              {hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
            </span>
            <span className="stat-label mono ct-text-faint">Net deposits</span>
          </div>

          <div className="flex flex-col gap-(--ct-space-1_5)">
            <span className="stat-label ct-text-muted border-b border-dotted border-(--ct-border-soft) w-fit">Positions</span>
            <span className="stat-value ct-text-strong tabular text-(length:--ct-text-lg)">
              {hasPositions ? String(positionsCount) : DASH}
            </span>
            <span className="stat-label mono ct-text-faint">{hasPositions ? "Active" : "None yet"}</span>
          </div>

          <div className="flex flex-col gap-(--ct-space-1_5)">
            <span className="stat-label ct-text-muted border-b border-dotted border-(--ct-border-soft) w-fit">Deployed</span>
            <span className="stat-value ct-text-strong tabular text-(length:--ct-text-lg)">
              {hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
            </span>
            <span className="stat-label mono ct-text-faint">{hasPositions ? formatUsdCompact(deployedUsdc) : "No principal"}</span>
          </div>

          <div className="flex flex-col gap-(--ct-space-1_5)">
            <span className="stat-label ct-text-muted border-b border-dotted border-(--ct-border-soft) w-fit">Accrued yield</span>
            <span className="stat-value ct-text-strong tabular text-(length:--ct-text-lg)">
              {hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
            </span>
            <span className="stat-label mono ct-text-faint">Since inception</span>
          </div>
        </div>
      </div>

      <div className="px-(--ct-space-6) py-(--ct-space-4) border-t border-(--ct-border-soft) flex items-center justify-between">
        <div className="flex items-center gap-(--ct-space-2)">
          <ShieldCheck size={14} className={isLive ? "ct-text-success" : "ct-text-muted"} strokeWidth={2} aria-hidden />
          <span className="body-xs ct-text-muted">Underlying proof</span>
        </div>
        <span className="body-xs mono ct-text-faint">{hasPositions ? (isLive ? "Current" : "Pending") : DASH}</span>
      </div>
    </PfCockpitPanel>
  );
}
