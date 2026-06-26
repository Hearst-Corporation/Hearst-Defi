import {
  ShieldCheck,
  Wallet,
  Layers,
  PieChart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
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

function KpiRow({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sublabel?: string;
}) {
  return (
    <div className="pf-sp2-kpi-row">
      <div className="pf-sp2-kpi-row__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="pf-sp2-kpi-row__body">
        <span className="pf-sp2-kpi-row__label">{label}</span>
        {sublabel ? (
          <span className="pf-sp2-kpi-row__sublabel">{sublabel}</span>
        ) : null}
      </div>
      <span className="pf-sp2-kpi-row__value tabular mono">{value}</span>
    </div>
  );
}

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

      {/* ── KPI list — stacked rows, icon-led ── */}
      <div className="pf-sp2-body">
        <div className="pf-sp2-kpi-list">
          <KpiRow
            icon={Wallet}
            label="Principal"
            sublabel="Net deposits"
            value={hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
          />
          <KpiRow
            icon={Layers}
            label="Positions"
            sublabel={hasPositions ? "Active" : "None yet"}
            value={hasPositions ? String(positionsCount) : DASH}
          />
          <KpiRow
            icon={PieChart}
            label="Deployed"
            sublabel={hasPositions ? formatUsdCompact(deployedUsdc) : "No principal"}
            value={hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
          />
          <KpiRow
            icon={TrendingUp}
            label="Accrued yield"
            sublabel="Since inception"
            value={hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
          />
        </div>

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
