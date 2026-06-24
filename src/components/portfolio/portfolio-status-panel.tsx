import { TrendingUp, ArrowDownToLine, ShieldCheck, Layers, Wallet } from "lucide-react";
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
  const asOf = updatedAt
    ? `As of ${dateFmt.format(updatedAt)}`
    : "Awaiting first position";
  const proofLabel = hasPositions
    ? source === "live"
      ? "Current"
      : "Pending"
    : DASH;
  const proofAccent = hasPositions && source === "live";

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio status"
      className="pf-status-panel !p-0"
    >
      {/* ── Header ── */}
      <div className="pf-sp-header">
        <div className="flex items-center justify-between min-w-0">
          <h2 className="pf-sp-header__title">Portfolio Status</h2>
          {provenance && <ProvenanceBadge kind={provenance} compact />}
        </div>
        {hasPositions && (
          <div
            className="pf-sp-deploy-track"
            role="meter"
            aria-valuenow={deploymentPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${deploymentPct.toFixed(0)}% deployed`}
          >
            <div
              className="pf-sp-deploy-fill"
              style={{ width: `${deploymentPct.toFixed(1)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── KPI rows ── */}
      <dl className="pf-sp-body">

        {/* Row 1 — Deployed */}
        <div className="pf-sp-row">
          <div className="pf-sp-row__icon">
            <Layers size={13} strokeWidth={2} aria-hidden />
          </div>
          <dt className="pf-sp-row__label">Deployed</dt>
          <dd className="pf-sp-row__trail">
            <span className={cn("pf-sp-row__value tabular", !hasPositions && "pf-sp-row__value--muted")}>
              {hasPositions ? `${deploymentPct.toFixed(0)}%` : DASH}
            </span>
            <span className="pf-sp-row__meta">
              {hasPositions ? formatUsdCompact(deployedUsdc) : "No principal"}
            </span>
          </dd>
        </div>

        {/* Row 2 — Positions */}
        <div className="pf-sp-row">
          <div className="pf-sp-row__icon">
            <Wallet size={13} strokeWidth={2} aria-hidden />
          </div>
          <dt className="pf-sp-row__label">Positions</dt>
          <dd className="pf-sp-row__trail">
            <span className={cn("pf-sp-row__value tabular", !hasPositions && "pf-sp-row__value--muted")}>
              {hasPositions ? String(positionsCount) : DASH}
            </span>
            <span className="pf-sp-row__meta">{hasPositions ? "Active" : "None yet"}</span>
          </dd>
        </div>

        {/* Row 3 — Accrued Yield (accent) */}
        <div className="pf-sp-row pf-sp-row--accent">
          <div className="pf-sp-row__icon pf-sp-row__icon--accent">
            <TrendingUp size={13} strokeWidth={2} aria-hidden />
          </div>
          <dt className="pf-sp-row__label">Accrued yield</dt>
          <dd className="pf-sp-row__trail">
            <span className={cn("pf-sp-row__value tabular", hasPositions ? "pf-sp-row__value--accent" : "pf-sp-row__value--muted")}>
              {hasPositions ? formatUsdCompact(accruedYieldUsdc) : DASH}
            </span>
            <span className="pf-sp-row__meta">Since inception</span>
          </dd>
        </div>

        {/* Row 4 — Net deposits */}
        <div className="pf-sp-row">
          <div className="pf-sp-row__icon">
            <ArrowDownToLine size={13} strokeWidth={2} aria-hidden />
          </div>
          <dt className="pf-sp-row__label">Net deposits</dt>
          <dd className="pf-sp-row__trail">
            <span className={cn("pf-sp-row__value tabular", !hasPositions && "pf-sp-row__value--muted")}>
              {hasPositions ? formatUsdCompact(deployedUsdc) : DASH}
            </span>
            <span className="pf-sp-row__meta">Principal subscribed</span>
          </dd>
        </div>

        {/* Row 5 — Underlying proof */}
        <div className="pf-sp-row pf-sp-row--last">
          <div className={cn("pf-sp-row__icon", proofAccent && "pf-sp-row__icon--accent")}>
            <ShieldCheck size={13} strokeWidth={2} aria-hidden />
          </div>
          <dt className="pf-sp-row__label">Underlying proof</dt>
          <dd className="pf-sp-row__trail">
            <span className={cn(
              "pf-sp-row__value tabular",
              proofAccent
                ? "pf-sp-row__value--accent"
                : !hasPositions
                  ? "pf-sp-row__value--muted"
                  : "",
            )}>
              {proofLabel}
            </span>
            <span className="pf-sp-row__meta truncate">{asOf}</span>
          </dd>
        </div>

      </dl>
    </PfCockpitPanel>
  );
}
