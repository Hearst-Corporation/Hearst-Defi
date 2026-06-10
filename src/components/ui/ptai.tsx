import { cn } from "@/lib/cn";

interface PtaiProps {
  projection: string;
  trigger: string;
  action: string;
  impact: string;
  className?: string;
}

// Each PTAI row maps to a Cockpit status / accent token. We keep the
// semantic mapping explicit so a token rename ripples to one place only.
const ROWS: ReadonlyArray<{ key: keyof PtaiProps; label: string; iconColorClass: string }> = [
  { key: "projection", label: "Projection", iconColorClass: "ct-status-info" },
  { key: "trigger", label: "Trigger", iconColorClass: "ct-status-warning" },
  { key: "action", label: "Action", iconColorClass: "ct-text-accent" },
  { key: "impact", label: "Impact", iconColorClass: "ct-status-success" },
];

export function Ptai({
  projection,
  trigger,
  action,
  impact,
  className,
}: PtaiProps) {
  const values: Record<"projection" | "trigger" | "action" | "impact", string> =
    { projection, trigger, action, impact };
  return (
    <div className={cn("glass-panel-subtle p-4 rounded-xl relative overflow-hidden group", className)}>
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[var(--ct-surface-3)] to-transparent opacity-50" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm relative z-[var(--ct-z-raised)]">
        {ROWS.map(({ key, label, iconColorClass }) => (
          <div key={key} className="contents group/row">
            <dt className="flex items-center gap-2 mono text-[length:var(--ct-text-micro)] uppercase tracking-wide ct-text-muted pt-0.5 group-hover/row:ct-text-body transition-colors">
              <span
                className={cn("h-1.5 w-1.5 rounded-full shadow-[var(--ct-glow-dot)] bg-current", iconColorClass)}
              />
              {label}
            </dt>
            <dd className="ct-text-body font-medium group-hover/row:ct-text-strong transition-colors">
              {values[key as "projection" | "trigger" | "action" | "impact"]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
