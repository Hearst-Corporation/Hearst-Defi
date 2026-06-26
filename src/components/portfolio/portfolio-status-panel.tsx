import { ShieldCheck } from "lucide-react";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Metric } from "@/components/ui/metric";
import { MetricGrid } from "@/components/ui/nested-panel";

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
  const asOf = updatedAt ? `As of ${dateFmt.format(updatedAt)}` : "Awaiting first position";
  const isLive = hasPositions && source === "live";

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel !p-0"
    >
      {/* ── Header band ── */}
      <div className="pf-sp2-header">
        <div className="pf-sp2-header__top">
          <div className="pf-sp2-header__title-row">
            <span className="pf-sp2-title">Portfolio Status</span>
            {isLive && (
              <span className="pf-sp2-live-pill" aria-label="Live data">
                <span className="pf-sp2-live-dot" aria-hidden="true" />
                Live
              </span>
            )}
          </div>
          {provenance && <ProvenanceBadge kind={provenance} compact />}
        </div>

        {/* Deployment progress bar — full width, accent fill, with percentage label */}
        {hasPositions && (
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
        )}
      </div>

      {/* ── KPI grid (2×2) — DS primitive: MetricGrid + Metric variant="nested" ── */}
      <div className="pf-sp2-body">
        <MetricGrid columns={2} className="pf-sp2-grid">
          <Metric
            variant="nested"
            label="Principal"
            value={hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
            sublabel="Net deposits"
          />
          <Metric
            variant="nested"
            label="Positions"
            value={hasPositions ? String(positionsCount) : DASH}
            sublabel={hasPositions ? "Active" : "None yet"}
          />
          <Metric
            variant="nested"
            label="Deployed"
            value={hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
            sublabel={hasPositions ? formatUsdCompact(deployedUsdc) : "No principal"}
          />
          <Metric
            variant="nested"
            label="Accrued yield"
            value={hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
            sublabel="Since inception"
          />
        </MetricGrid>

        {/* Proof strip — full width, green accent ONLY when live + verified */}
        <div className={cn("pf-sp2-proof", isLive && "pf-sp2-proof--live")}>
          <div className={cn("pf-sp2-proof__icon", isLive && "pf-sp2-proof__icon--live")}>
            <ShieldCheck size={13} strokeWidth={2} aria-hidden />
          </div>
          <div className="pf-sp2-proof__body">
            <span className="pf-sp2-proof__name">Underlying proof</span>
            <span className={cn("pf-sp2-proof__status", isLive && "pf-sp2-proof__status--live")}>
              {hasPositions ? (source === "live" ? "Current" : "Pending") : DASH}
            </span>
          </div>
          <span className="pf-sp2-proof__date">{asOf}</span>
        </div>
      </div>
    </PfCockpitPanel>
  );
}
