import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Tooltip } from "@/components/ui/tooltip";
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
        <EmptySurface
          variant="inline"
          message="No risk inputs yet."
          detail="This block populates after the first vault snapshot and mining metric are recorded."
          ariaLabel="Risk posture"
          className="flex-1 flex items-center justify-center py-(--ct-space-8)"
        />
      </div>
    );
  }

  return (
    <div className="dashboard-risk-summary" data-risk-provenance={provenance}>

      <div className="dashboard-risk-summary__body flex flex-col gap-4">
        <div className="dashboard-risk-summary__overview flex items-start justify-between bg-ct-bg-soft/30 p-3 rounded-(--ct-radius-sm) border border-(--ct-border-ghost)">
          <div className="dashboard-risk-summary__hero flex flex-col gap-1">
            <div className="dashboard-risk-summary__headline">
              <Tooltip
                content={(
                  <div className="dashboard-metric-tooltip">
                    <div className="dashboard-metric-tooltip__title">Composite Risk Score</div>
                    <div className="dashboard-metric-tooltip__desc">Aggregated risk metric across all dimensions. 0-30 Low, 31-70 Medium, 71-100 High.</div>
                  </div>
                )}
              >
                <div className="cursor-help">
                  <span className="cockpit-label-sm block mb-0.5">Composite score</span>
                  <div className="dashboard-risk-summary__headline-row flex items-baseline gap-1">
                    <span
                      className={cn(
                        "text-(length:--ct-text-display-fixed) font-bold tabular tracking-tighter leading-none",
                        data.band === "low"
                          ? "ct-status-success"
                          : data.band === "medium"
                            ? "ct-status-warning"
                            : "ct-status-danger",
                      )}
                    >
                      {data.composite}
                    </span>
                    <span className="text-(length:--ct-text-2xs) font-bold ct-text-faint tabular opacity-50">/ 100</span>
                  </div>
                </div>
              </Tooltip>
            </div>
            <Badge
              variant={
                data.band === "low"
                  ? "success"
                  : data.band === "medium"
                    ? "warning"
                    : "danger"
              }
              className="px-2 py-0.5 cockpit-label-xs w-fit"
            >
              {data.bandLabel}
            </Badge>
          </div>

          <div className="flex-1 max-w-[200px] ml-4">
            <p className="dashboard-risk-summary__blurb cockpit-value-xs m-0 leading-tight uppercase tracking-tight">
              Five-factor operator view: contract, mining, counterparties, market, liquidity.
            </p>
          </div>
        </div>

        <div className="dashboard-risk-summary__grid grid grid-cols-1 gap-2">
          {data.dimensions.map((dimension) => (
            <article
              key={dimension.id}
              className="dashboard-risk-summary__item group bg-ct-bg-soft/20 p-2 rounded-(--ct-radius-xs) border border-transparent hover:border-(--ct-border-ghost) transition-all"
              aria-label={`${dimension.label}: ${dimension.score} out of 100, ${dimension.status}`}
            >
              <div className="dashboard-risk-summary__item-top flex items-center justify-between mb-1.5">
                <div className="dashboard-risk-summary__item-copy flex items-center gap-3">
                  <span className="cockpit-value-md uppercase tracking-tight min-w-[100px]">
                    {dimension.label}
                  </span>
                  <Badge variant={SEVERITY_BADGE[dimension.severity]} className="cockpit-label-xs px-1.5 py-0 h-3.5 min-w-0">
                    {dimension.status}
                  </Badge>
                  <p className="cockpit-label-sm m-0 leading-none opacity-70 group-hover:opacity-100 transition-opacity">
                    {dimension.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "cockpit-value-md",
                    SEVERITY_TEXT[dimension.severity],
                  )}
                >
                  {dimension.score}
                </span>
              </div>

              <Progress
                value={dimension.score}
                variant="plain"
                fillClassName={cn(SEVERITY_FILL[dimension.severity], "transition-all duration-500")}
                className="dashboard-risk-summary__progress h-1 bg-ct-bg-deep"
                label={`${dimension.label} risk score ${dimension.score} of 100`}
              />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
