import { ShieldCheck, TrendingUp, Layers, Wallet, ArrowDownToLine } from "lucide-react";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";

const DASH = "—";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
  updatedAt,
  embedded = false,
}: PortfolioStatusPanelProps) {
  const deploymentPct =
    hasPositions && totalValueUsdc > 0
      ? Math.min(100, (deployedUsdc / totalValueUsdc) * 100)
      : 0;

  const isLive = hasPositions && source === "live";
  const proofStatus = !hasPositions ? DASH : isLive ? "Current" : "Reference";
  const proofMeta = !hasPositions
    ? "Awaiting first position"
    : updatedAt
      ? isLive
        ? `As of ${dateFmt.format(updatedAt)}`
        : "Reference snapshot"
      : isLive
        ? "Awaiting latest proof"
        : "Reference snapshot";

  return (
    <div className="pf-status-panel pf-embedded-pane p-0!" aria-label="Portfolio status">
      <div className="pf-status-body">
        <div className="pf-status-tiles">
          <div className="pf-status-tile">
            <div className="pf-status-tile__top">
              <span className="pf-status-tile__icon">
                <ArrowDownToLine size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="pf-status-tile__label">Principal</span>
            </div>
            <span className={cn("pf-status-tile__value tabular", !hasPositions && "pf-status-tile__value--dim")}>
              {hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
            </span>
            <span className="pf-status-tile__sub">Net deposits</span>
          </div>

          <div className="pf-status-tile">
            <div className="pf-status-tile__top">
              <span className="pf-status-tile__icon">
                <Wallet size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="pf-status-tile__label">Positions</span>
            </div>
            <span className={cn("pf-status-tile__value tabular", !hasPositions && "pf-status-tile__value--dim")}>
              {hasPositions ? String(positionsCount) : DASH}
            </span>
            <span className="pf-status-tile__sub">{hasPositions ? "Active" : "None yet"}</span>
          </div>

          <div className="pf-status-tile">
            <div className="pf-status-tile__top">
              <span className="pf-status-tile__icon">
                <Layers size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="pf-status-tile__label">Deployed</span>
            </div>
            <span className={cn("pf-status-tile__value tabular", !hasPositions && "pf-status-tile__value--dim")}>
              {hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
            </span>
            <span className="pf-status-tile__sub">Of total capital</span>
          </div>

          <div className="pf-status-tile pf-status-tile--yield">
            <div className="pf-status-tile__top">
              <span className="pf-status-tile__icon pf-status-tile__icon--accent">
                <TrendingUp size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="pf-status-tile__label">Accrued yield</span>
            </div>
            <span
              className={cn(
                "pf-status-tile__value tabular",
                hasPositions ? "pf-status-tile__value--accent" : "pf-status-tile__value--dim",
              )}
            >
              {hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
            </span>
            <span className="pf-status-tile__sub">Since inception</span>
          </div>
        </div>

        <div className={cn("pf-status-proof", isLive && "pf-status-proof--live")}>
          <div className={cn("pf-status-proof__icon", isLive && "pf-status-proof__icon--live")}>
            <ShieldCheck size={13} strokeWidth={2} aria-hidden />
          </div>
          <div className="pf-status-proof__body">
            <span className="pf-status-proof__name">Underlying proof</span>
            <span className={cn("pf-status-proof__status", isLive && "pf-status-proof__status--live")}>
              {proofStatus}
            </span>
          </div>
          <span className="pf-status-proof__date">{proofMeta}</span>
        </div>
      </div>
    </div>
  );
}
