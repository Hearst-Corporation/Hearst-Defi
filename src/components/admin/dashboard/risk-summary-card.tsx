import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { resolveRiskProvenance } from "@/lib/admin/dashboard-board-view";
import { cn } from "@/lib/cn";
import type {
  RiskFrameworkData,
  RiskSeverity,
} from "@/lib/data/risk-framework";

const SEVERITY_FILL: Record<RiskSeverity, string> = {
  low: "cockpit-risk-fill--low",
  medium: "cockpit-risk-fill--medium",
  high: "cockpit-risk-fill--high",
};

const SEVERITY_TEXT: Record<RiskSeverity, string> = {
  low: "ct-status-success",
  medium: "ct-status-warning",
  high: "ct-status-danger",
};

const SEVERITY_BADGE: Record<RiskSeverity, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

/**
 * Risk summary content — no panel wrapper (parent cell provides the surface).
 */
export function DashboardRiskSummaryCard({
  data,
  hasLiveKpis,
  simulated,
}: {
  data: RiskFrameworkData;
  hasLiveKpis: boolean;
  simulated?: boolean;
}) {
  const provenance = resolveRiskProvenance(hasLiveKpis, data, simulated);

  if (data.source === "fallback") {
    return (
      <div className="dashboard-risk-summary" data-risk-provenance={provenance}>
        <div className="dashboard-risk-summary__empty">
          <p className="body-sm ct-text-muted m-0">No risk inputs yet.</p>
          <p className="body-xs ct-text-faint m-0">
            This block populates after the first vault snapshot and mining
            metric are recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-risk-summary" data-risk-provenance={provenance}>

      <div className="dashboard-risk-summary__body">
        <div className="dashboard-risk-summary__overview">
          <div className="dashboard-risk-summary__hero">
            <div className="dashboard-risk-summary__headline">
              <span className="stat-label">Composite</span>
              <div className="dashboard-risk-summary__headline-row">
                <span
                  className={cn(
                    "dashboard-risk-summary__value stat-value tabular",
                    data.band === "low"
                      ? "ct-status-success"
                      : data.band === "medium"
                        ? "ct-status-warning"
                        : "ct-status-danger",
                  )}
                >
                  {data.composite}
                </span>
                <span className="body-xs ct-text-faint tabular">/ 100</span>
              </div>
            </div>
            <Badge
              variant={
                data.band === "low"
                  ? "success"
                  : data.band === "medium"
                    ? "warning"
                    : "danger"
              }
            >
              {data.bandLabel}
            </Badge>
          </div>

          <p className="dashboard-risk-summary__blurb body-sm ct-text-muted m-0">
            Five-factor operator view across contract, mining, counterparties,
            market, and liquidity.
          </p>

          <p className="dashboard-risk-summary__footnote body-xs ct-text-faint m-0">
            Weighted five-factor model from Methodology v1.0. Conditional
            signal, not guaranteed.
          </p>
        </div>

        <div className="dashboard-risk-summary__grid">
          {data.dimensions.map((dimension) => (
            <article
              key={dimension.id}
              className="dashboard-risk-summary__item"
              aria-label={`${dimension.label}: ${dimension.score} out of 100, ${dimension.status}`}
            >
              <div className="dashboard-risk-summary__item-top">
                <div className="dashboard-risk-summary__item-copy">
                  <div className="admin-doc-inline-row admin-doc-inline-row--dense admin-doc-inline-row--start">
                    <span className="body-sm ct-text-strong">
                      {dimension.label}
                    </span>
                    <Badge variant={SEVERITY_BADGE[dimension.severity]}>
                      {dimension.status}
                    </Badge>
                  </div>
                  <p className="body-xs ct-text-faint m-0">
                    {dimension.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "dashboard-risk-summary__score tabular",
                    SEVERITY_TEXT[dimension.severity],
                  )}
                >
                  {dimension.score}
                </span>
              </div>

              <Progress
                value={dimension.score}
                variant="plain"
                fillClassName={SEVERITY_FILL[dimension.severity]}
                className="dashboard-risk-summary__progress"
                label={`${dimension.label} risk score ${dimension.score} of 100`}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
