import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
import { Card } from "@/components/catalyst/card";
import { Tooltip } from "@/components/catalyst/tooltip";
import { cn } from "@/lib/cn";

interface MetricProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  provenance?: Provenance;
  tooltip?: string;
  className?: string;
  variant?: "premium" | "plain" | "nested";
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
          <span className="ct-metric-nested__sublabel stat-label mono">
            {sublabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Card
      hoverOverlay={false}
      className={cn(
        "flex flex-col gap-(--ct-space-2)",
        premium && "card-premium group",
        className,
      )}
    >
      {premium ? (
        <div className="absolute inset-0 ct-overlay-accent5 opacity-0 group-hover:opacity-100 ct-transition-opacity-slow pointer-events-none" />
      ) : null}

      <div className="flex items-center justify-between gap-(--ct-space-2) relative z-10">
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span className="stat-label ct-text-muted ct-text-body-group-hover transition-colors ease-[var(--ct-ease)] cursor-help border-b border-dotted border-(--ct-border-soft)">
              {label}
            </span>
          </Tooltip>
        ) : (
          <span className="stat-label ct-text-muted ct-text-body-group-hover transition-colors ease-[var(--ct-ease)]">
            {label}
          </span>
        )}
        {provenance ? <ProvenanceBadge kind={provenance} /> : null}
      </div>

      <div className="flex items-baseline gap-(--ct-space-1) relative z-10">
        <span className="stat-value ct-text-strong">
          {value}
        </span>
      </div>

      {(sublabel || trend) && (
        <div className="flex min-w-0 items-center gap-(--ct-space-2) body-xs ct-text-muted relative z-10 pt-(--ct-space-1) border-t ct-bc-soft-50">
          {trend ? (
            <span
              className={cn(
                "font-medium shrink-0 px-(--ct-space-1_5) py-(--ct-space-0_5) rounded-sm border",
                trend.direction === "up" && "ct-status-success-bg ct-status-success ct-bc-success",
                trend.direction === "down" && "ct-status-danger-bg ct-status-danger ct-bc-danger",
                trend.direction === "flat" && "ct-surface-1 ct-text-muted ct-bc-base",
              )}
            >
              {trend.direction === "up" ? "↑ " : trend.direction === "down" ? "↓ " : "→ "}
              {trend.text}
            </span>
          ) : null}
          {sublabel ? (
            <span className="truncate opacity-[var(--ct-opacity-70)] stat-label mono">
              {sublabel}
            </span>
          ) : null}
        </div>
      )}
    </Card>
  );
}
