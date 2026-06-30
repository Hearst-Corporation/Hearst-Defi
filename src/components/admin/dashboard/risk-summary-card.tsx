import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { BentoLabel } from "@/components/catalyst/bento";
import { Progress } from "@/components/catalyst/progress";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Tooltip } from "@/components/catalyst/tooltip";
import { resolveRiskProvenance } from "@/lib/admin/dashboard-board-view";
import { cn } from "@/lib/cn";
import type {
  RiskFrameworkData,
  RiskSeverity,
} from "@/lib/data/risk-framework";

/** Severity → Progress fill (single accent for low, warning/danger otherwise). */
const SEVERITY_FILL: Record<RiskSeverity, string> = {
  low: "bg-[var(--ct-accent)]",
  medium: "bg-[var(--ct-status-warning)]",
  high: "bg-[var(--ct-status-danger)]",
};

/** Severity → value text color. */
const SEVERITY_TEXT: Record<RiskSeverity, string> = {
  low: "text-[var(--ct-accent)]",
  medium: "text-[var(--ct-status-warning)]",
  high: "text-[var(--ct-status-danger)]",
};

const SEVERITY_BADGE: Record<RiskSeverity, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const BAND_TEXT: Record<RiskFrameworkData["band"], string> = {
  low: "text-[var(--ct-accent)]",
  medium: "text-[var(--ct-status-warning)]",
  high: "text-[var(--ct-status-danger)]",
};

const BAND_BADGE: Record<
  RiskFrameworkData["band"],
  "success" | "warning" | "danger"
> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

/**
 * Risk summary content — no panel wrapper (parent cell provides the surface).
 * Bento canon: sub-surfaces on --ct-surface-inset, micro labels, single accent.
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
      <div className="px-5 py-8" data-risk-provenance={provenance}>
        <EmptySurface
          variant="inline"
          message="No risk inputs yet."
          detail="This block populates after the first vault snapshot and mining metric are recorded."
          ariaLabel="Risk posture"
          className="flex flex-1 items-center justify-center"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-risk-provenance={provenance}>
      {/* Overview hero — composite score flush edge-to-edge like KPI strip. */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--ct-border-soft)] bg-surface-inset px-5 py-4">
        <div className="flex flex-col gap-1">
          <Tooltip
            content={
              <div className="dashboard-metric-tooltip">
                <div className="dashboard-metric-tooltip__title">
                  Composite Risk Score
                </div>
                <div className="dashboard-metric-tooltip__desc">
                  Aggregated risk metric across all dimensions. 0-30 Low, 31-70
                  Medium, 71-100 High.
                </div>
              </div>
            }
          >
            <div className="cursor-help">
              <BentoLabel className="mb-1 block">Composite score</BentoLabel>
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-[length:var(--ct-text-display)] font-bold leading-none tracking-tighter tabular-nums",
                    BAND_TEXT[data.band],
                  )}
                >
                  {data.composite}
                </span>
                <span className="text-[length:var(--ct-text-2xs)] font-bold tabular-nums text-[var(--ct-text-faint)]">
                  / 100
                </span>
              </div>
            </div>
          </Tooltip>
          <Badge
            variant={BAND_BADGE[data.band]}
            className="w-fit px-2 py-0.5 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-[0.15em]"
          >
            {data.bandLabel}
          </Badge>
        </div>

        <p className="m-0 ml-4 max-w-[200px] flex-1 text-[length:var(--ct-text-micro)] uppercase leading-tight tracking-tight text-[var(--ct-text-faint)]">
          Five-factor operator view: contract, mining, counterparties, market,
          liquidity.
        </p>
      </div>

      {/* Per-dimension rows — label + status badge + detail + score + bar. */}
      <div className="grid grid-cols-1 gap-2 px-5 py-4">
        {data.dimensions.map((dimension) => (
          <article
            key={dimension.id}
            className="group rounded-md border border-transparent bg-surface-inset p-2 transition-colors hover:border-[var(--ct-border)]"
            aria-label={`${dimension.label}: ${dimension.score} out of 100, ${dimension.status}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="min-w-[100px] text-[length:var(--ct-text-xs)] font-medium uppercase tracking-tight text-[var(--ct-text-body)]">
                  {dimension.label}
                </span>
                <Badge
                  variant={SEVERITY_BADGE[dimension.severity]}
                  className="h-3.5 min-w-0 px-1.5 py-0 text-[length:var(--ct-text-deci)] font-bold uppercase tracking-[0.15em]"
                >
                  {dimension.status}
                </Badge>
                <p className="m-0 text-[length:var(--ct-text-micro)] leading-none text-[var(--ct-text-faint)] opacity-[var(--ct-opacity-70)] transition-opacity group-hover:opacity-100">
                  {dimension.detail}
                </p>
              </div>
              <span
                className={cn(
                  "text-[length:var(--ct-text-xs)] font-medium tabular-nums",
                  SEVERITY_TEXT[dimension.severity],
                )}
              >
                {dimension.score}
              </span>
            </div>

            <Progress
              value={dimension.score}
              variant="plain"
              fillClassName={cn(
                SEVERITY_FILL[dimension.severity],
                "transition-all duration-500",
              )}
              className="h-1 rounded-full bg-surface-card"
              label={`${dimension.label} risk score ${dimension.score} of 100`}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
