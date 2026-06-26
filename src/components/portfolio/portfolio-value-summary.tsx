import { PfCockpitPanel, PfCockpitPanelHeader } from "@/components/portfolio/pf-cockpit-panel";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdDetailed } from "@/lib/vaults/product-display";

interface PortfolioValueSummaryProps {
  totalValueUsdc: number;
  positionsCount: number;
  deployedUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function PortfolioValueSummary({
  totalValueUsdc,
  positionsCount,
  deployedUsdc,
  source,
  updatedAt,
  embedded = false,
}: PortfolioValueSummaryProps) {
  const isEmpty = totalValueUsdc === 0 && positionsCount === 0;
  const provenance = isEmpty ? undefined : resolveProvenance(source, updatedAt, "estimated");
  const provenanceLabel = provenance === "live" ? "Live NAV" : "Estimated NAV";
  const formattedDate = updatedAt ? dateFmt.format(updatedAt) : null;
  const deploymentPct =
    !isEmpty && totalValueUsdc > 0
      ? Math.min(100, (deployedUsdc / totalValueUsdc) * 100)
      : 0;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio value"
      className="pf-pv-summary"
    >
      <PfCockpitPanelHeader
        title="Portfolio Value"
        titleVariant="primary"
        subtitle={formattedDate ?? undefined}
        titleEnd={
          !isEmpty && provenance ? (
            <span className="pf-pv-summary__provenance">{provenanceLabel}</span>
          ) : undefined
        }
      />

      {isEmpty ? (
        <div className="pf-pv-summary__empty">
          <span className="pf-pv-summary__empty-label">No position yet</span>
        </div>
      ) : (
        <div className="pf-pv-summary__body">
          <div className="pf-pv-summary__value-row">
            <span className="pf-pv-summary__currency">$</span>
            <span className="pf-pv-summary__value tabular-nums">
              {formatUsdDetailed(totalValueUsdc).replace("$", "")}
            </span>
          </div>

          <div className="pf-pv-summary__meta-row">
            <span className="pf-pv-summary__meta-item">
              {positionsCount} active {positionsCount === 1 ? "position" : "positions"}
            </span>
            <span className="pf-pv-summary__meta-item">
              {deploymentPct.toFixed(0)}% deployed
            </span>
            <span className="pf-pv-summary__meta-item">Proof current</span>
          </div>

          <p className="pf-pv-summary__ledger-note">
            <span>Ledger-based valuation</span>
            <span>Chart hidden until sufficient history is available</span>
          </p>
        </div>
      )}
    </PfCockpitPanel>
  );
}
