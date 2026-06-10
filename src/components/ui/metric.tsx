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
   * sit together and the texture would become noise.
   */
  variant?: "premium" | "plain";
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
  const premium = variant !== "plain";
  return (
    <div
      className={cn(
        "dash-cell flex flex-col gap-3 relative overflow-hidden group",
        premium && "dash-cell-premium",
        className,
      )}
    >
      {/* Ambient subtle glow on hover — premium tier only. */}
      {premium ? (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--ct-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--ct-dur-slow)] pointer-events-none" />
      ) : null}

      <div className="flex items-center justify-between gap-2 relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)] group-hover:text-[var(--ct-text-body)] transition-colors" title={tooltip}>
          {label}
        </span>
        {provenance ? <ProvenanceBadge kind={provenance} /> : null}
      </div>

      <div className="flex items-baseline gap-1 mt-auto relative z-10">
        <span
          className={cn(
            "text-3xl font-light tracking-tighter text-[var(--ct-text-strong)] tabular-nums",
            premium && "drop-shadow-[var(--ct-glow-subtle)]",
          )}
        >
          {value}
        </span>
      </div>

      {(sublabel || trend) && (
        <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--ct-text-muted)] relative z-10 mt-1 pt-1 border-t border-[var(--ct-border-soft)]/50">
          {trend ? (
            <span
              className={cn(
                "font-medium shrink-0 px-1.5 py-0.5 rounded-[var(--ct-radius-sm)] backdrop-blur-md border",
                trend.direction === "up" && "bg-[var(--ct-status-success-soft)] text-[var(--ct-status-success)] border-[var(--ct-status-success-border)]",
                trend.direction === "down" && "bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)] border-[var(--ct-status-danger-border)]",
                trend.direction === "flat" && "bg-[var(--ct-surface-1)] text-[var(--ct-text-muted)] border-[var(--ct-border)]"
              )}
            >
              {trend.direction === "up"
                ? "↑ "
                : trend.direction === "down"
                  ? "↓ "
                  : "→ "}
              {trend.text}
            </span>
          ) : null}
          {sublabel ? <span className="truncate opacity-70 mono uppercase tracking-wider text-micro">{sublabel}</span> : null}
        </div>
      )}
    </div>
  );
}
