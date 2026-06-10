import { Card } from "@/components/ui/card";
import {
  ProvenanceBadge,
  type Provenance,
} from "@/components/ui/provenance-badge";
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
  variant?: "premium" | "plain" | "dashboard";
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
  const body = (
    <>
      {premium ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--ct-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--ct-dur-slow)] pointer-events-none" />
      ) : null}

      <div
        className={cn(
          "flex items-center justify-between gap-2 relative z-10",
          dashboard && "metric-dashboard-head",
        )}
      >
        <span
          className={cn(
            "stat-label ct-text-muted group-hover:ct-text-body transition-colors",
            dashboard && "metric-dashboard-label",
          )}
          title={tooltip}
        >
          {label}
        </span>
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
            premium && "drop-shadow-[var(--ct-glow-subtle)]",
            dashboard && "metric-dashboard-value",
          )}
        >
          {value}
        </span>
      </div>

      {(sublabel || trend) && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 text-xs ct-text-muted relative z-10 pt-1 border-t border-[var(--ct-border-soft)]/50",
            dashboard && "metric-dashboard-footer",
          )}
        >
          {trend ? (
            <span
              className={cn(
                "font-medium shrink-0 px-1.5 py-0.5 rounded-sm backdrop-blur-md border",
                trend.direction === "up" && "ct-status-success-bg ct-status-success border-[var(--ct-status-success-border)]",
                trend.direction === "down" && "ct-status-danger-bg ct-status-danger border-[var(--ct-status-danger-border)]",
                trend.direction === "flat" && "ct-surface-1 ct-text-muted border-[var(--ct-border)]"
              )}
            >
              {trend.direction === "up" ? "↑ " : trend.direction === "down" ? "↓ " : "→ "}
              {trend.text}
            </span>
          ) : null}
          {sublabel ? (
            <span
              className={cn(
                "truncate opacity-70 mono uppercase tracking-wider text-micro",
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
