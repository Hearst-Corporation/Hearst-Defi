import { Card } from "@/components/ui/card";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

interface MetricProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  provenance?: Provenance;
  tooltip?: string;
  className?: string;
  /**
   * Visual tier. Default "premium" keeps the existing look exactly (dot pattern,
   * hover glow overlay, accent value glow) — so every current usage is
   * unchanged. "plain" opts OUT of the decorative premium chrome for a calm,
   * flat metric (no dots, no overlay, no value glow) — use it where many metrics
   * sit together and the texture would become noise. "dashboard" is the denser
   * admin-dashboard hero KPI treatment: larger numerals, clearer labels, calmer
   * provenance chrome.
   */
  /**
   * "nested" — calm label/value inside a parent Card or dash-cell. No kpi-cell
   * chrome, no per-cell provenance (block badge on the parent). Use with
   * NestedKpiGrid from nested-panel.tsx.
   */
  variant?: "premium" | "plain" | "dashboard" | "nested";
}

export function Metric({
  label,
  value,
  sublabel,
  trend,
  provenance,
  tooltip,
  className,
  variant = "premium",
}: MetricProps) {
  const premium = variant === "premium";
  const dashboard = variant === "dashboard";
  const nested = variant === "nested";

  const labelContent = tooltip ? (
    <Tooltip content={tooltip}>
      <span className="stat-label ct-text-muted cursor-help border-b border-dotted border-(--ct-border-soft)">
        {label}
      </span>
    </Tooltip>
  ) : (
    <span className="stat-label ct-text-muted">
      {label}
    </span>
  );

  if (nested) {
    return (
      <div className={cn("ct-metric-nested", className)}>
        {labelContent}
        <span className={cn("ct-metric-nested__value stat-value ct-text-strong tabular")}>
          {value}
        </span>
        {sublabel ? (
          <span className="ct-metric-nested__sublabel body-xs ct-text-muted mono uppercase ct-tracking-wide">
            {sublabel}
          </span>
        ) : null}
      </div>
    );
  }

  const body = (
    <>
      {premium ? (
        <div className="absolute inset-0 ct-overlay-accent5 opacity-0 group-hover:opacity-100 ct-transition-opacity-slow pointer-events-none" />
      ) : null}

      <div
        className={cn(
          "flex items-center justify-between gap-2 relative z-10",
          dashboard && "metric-dashboard-head",
        )}
      >
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span
              className={cn(
                "stat-label ct-text-muted group-hover:ct-text-body transition-colors cursor-help border-b border-dotted border-(--ct-border-soft)",
                dashboard && "metric-dashboard-label",
              )}
            >
              {label}
            </span>
          </Tooltip>
        ) : (
          <span
            className={cn(
              "stat-label ct-text-muted group-hover:ct-text-body transition-colors",
              dashboard && "metric-dashboard-label",
            )}
          >
            {label}
          </span>
        )}
        {provenance ? (
          <span className={cn(dashboard && "metric-dashboard-provenance")}>
            <ProvenanceBadge kind={provenance} />
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-1 relative z-10">
        <span
          className={cn(
            "stat-value ct-text-strong",
            premium && "ct-drop-glow-subtle",
            dashboard && "metric-dashboard-value",
          )}
        >
          {value}
        </span>
      </div>

      {(sublabel || trend) && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 text-xs ct-text-muted relative z-10 pt-1 border-t ct-bc-soft-50",
            dashboard && "metric-dashboard-footer",
          )}
        >
          {trend ? (
            <span
              className={cn(
                "font-medium shrink-0 px-1.5 py-0.5 rounded-sm backdrop-blur-md border",
                trend.direction === "up" && "ct-status-success-bg ct-status-success ct-bc-success",
                trend.direction === "down" && "ct-status-danger-bg ct-status-danger ct-bc-danger",
                trend.direction === "flat" && "ct-surface-1 ct-text-muted ct-bc-base"
              )}
            >
              {trend.direction === "up" ? "↑ " : trend.direction === "down" ? "↓ " : "→ "}
              {trend.text}
            </span>
          ) : null}
          {sublabel ? (
            <span
              className={cn(
                "truncate opacity-70 mono uppercase ct-tracking-wide text-micro",
                dashboard && "metric-dashboard-sublabel",
              )}
            >
              {sublabel}
            </span>
          ) : null}
        </div>
      )}
    </>
  );

  if (dashboard) {
    return (
      <Card className={cn("metric-dashboard-card flex flex-col gap-3 h-full", className)}>
        {body}
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "kpi-cell flex flex-col gap-2 relative overflow-hidden group",
        premium && "kpi-cell-premium",
        className,
      )}
    >
      {body}
    </div>
  );
}
