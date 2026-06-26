import { ShieldCheck, TrendingUp, Layers, Wallet, ArrowDownToLine } from "lucide-react";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

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

  const provenance = hasPositions ? resolveProvenance(source, updatedAt) : undefined;
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
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel p-0!"
    >
      <div className="pf-sp2-header">
        <div className="pf-sp2-header__top">
          <div className="pf-sp2-header__title-row">
            <span className="pf-sp2-title">Portfolio Status</span>
            {isLive ? (
              <span className="pf-sp2-live-pill" aria-label="Live data">
                <span className="pf-sp2-live-dot" aria-hidden="true" />
                Live
              </span>
            ) : null}
          </div>
          {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
        </div>

        {hasPositions ? (
          <div
            className="pf-sp2-deploy-track"
            role="meter"
            aria-valuenow={deploymentPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${deploymentPct.toFixed(0)}% deployed`}
          >
            <div
              className="pf-sp2-deploy-fill"
              style={{ width: `${Math.min(100, deploymentPct).toFixed(1)}%` }}
            />
            <span className="pf-sp2-deploy-label">
              {deploymentPct.toFixed(0)}% deployed
            </span>
          </div>
        ) : null}
      </div>

      <div className="pf-sp2-body">
        <div className="pf-sp2-tiles">
          <div className="pf-sp2-tile">
            <div className="pf-sp2-tile__icon">
              <ArrowDownToLine size={13} strokeWidth={2.2} aria-hidden />
            </div>
            <span className="pf-sp2-tile__label">Principal</span>
            <span className={cn("pf-sp2-tile__value tabular", !hasPositions && "pf-sp2-tile__value--dim")}>
              {hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
            </span>
            <span className="pf-sp2-tile__sub">Net deposits</span>
          </div>

          <div className="pf-sp2-tile">
            <div className="pf-sp2-tile__icon">
              <Wallet size={13} strokeWidth={2.2} aria-hidden />
            </div>
            <span className="pf-sp2-tile__label">Positions</span>
            <span className={cn("pf-sp2-tile__value tabular", !hasPositions && "pf-sp2-tile__value--dim")}>
              {hasPositions ? String(positionsCount) : DASH}
            </span>
            <span className="pf-sp2-tile__sub">{hasPositions ? "Active" : "None yet"}</span>
          </div>

          <div className="pf-sp2-tile">
            <div className="pf-sp2-tile__icon">
              <Layers size={13} strokeWidth={2.2} aria-hidden />
            </div>
            <span className="pf-sp2-tile__label">Deployed</span>
            <span className={cn("pf-sp2-tile__value tabular", !hasPositions && "pf-sp2-tile__value--dim")}>
              {hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
            </span>
            <span className="pf-sp2-tile__sub">
              {hasPositions ? formatUsdCompact(deployedUsdc) : "No principal"}
            </span>
          </div>

          <div className="pf-sp2-tile pf-sp2-tile--yield">
            <div className="pf-sp2-tile__icon pf-sp2-tile__icon--accent">
              <TrendingUp size={13} strokeWidth={2.2} aria-hidden />
            </div>
            <span className="pf-sp2-tile__label">Accrued yield</span>
            <span
              className={cn(
                "pf-sp2-tile__value tabular",
                hasPositions ? "pf-sp2-tile__value--accent" : "pf-sp2-tile__value--dim",
              )}
            >
              {hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
            </span>
            <span className="pf-sp2-tile__sub">Since inception</span>
          </div>
        </div>

        <div className={cn("pf-sp2-proof", isLive && "pf-sp2-proof--live")}>
          <div className={cn("pf-sp2-proof__icon", isLive && "pf-sp2-proof__icon--live")}>
            <ShieldCheck size={13} strokeWidth={2} aria-hidden />
          </div>
          <div className="pf-sp2-proof__body">
            <span className="pf-sp2-proof__name">Underlying proof</span>
            <span className={cn("pf-sp2-proof__status", isLive && "pf-sp2-proof__status--live")}>
              {proofStatus}
            </span>
          </div>
          <span className="pf-sp2-proof__date">{proofMeta}</span>
        </div>
      </div>
    </PfCockpitPanel>
  );
}
