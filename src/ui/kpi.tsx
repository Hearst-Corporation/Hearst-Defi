import { cn } from "@/lib/cn";
import { ProvenanceBadge } from "@/ui/badge";

export function Kpi({
  label,
  value,
  delta,
  provenance,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  provenance?: React.ComponentProps<typeof ProvenanceBadge>["source"];
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <span className="hc-metric-label">{label}</span>
        {provenance ? <ProvenanceBadge source={provenance} /> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="hc-metric-value">{value}</span>
        {delta ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              delta.positive ? "text-accent" : "text-muted",
            )}
          >
            {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
