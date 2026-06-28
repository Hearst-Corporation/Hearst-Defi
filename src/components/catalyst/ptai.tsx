/**
 * Catalyst Ptai — canonical PTAI grid for Hearst Connect.
 *
 * Renders the mandatory simulation/rebalancing format: Projection → Trigger →
 * Action → Impact (PTAI), one row per phase, each dot mapped to a Cockpit status
 * / accent token. Token-only (all surfaces, spacing, colour and motion come from
 * `--ct-*` / the `.ct-*` class layer in cockpit.css). This is the canon:
 * `src/components/ui/ptai` is a thin compatibility wrapper that re-exports this
 * symbol. New code should import Ptai from `@/components/catalyst/ptai`.
 *
 * `inset` (default) wraps the rows in a NestedPanel; `flat` drops the nested box
 * so the parent card owns the surface (anti cage-in-cage). Dark mode only — no
 * `dark:` modifiers.
 */

import { NestedPanel } from "@/components/catalyst/nested-panel";
import { cn } from "@/lib/cn";

interface PtaiProps {
  projection: string;
  trigger: string;
  action: string;
  impact: string;
  /** `flat` = no nested box (parent card owns the surface). */
  variant?: "inset" | "flat";
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
  variant = "inset",
  className,
}: PtaiProps) {
  const values: Record<"projection" | "trigger" | "action" | "impact", string> =
    { projection, trigger, action, impact };

  const rows = (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-3)] body-sm">
      {ROWS.map(({ key, label, iconColorClass }) => (
        <div key={key} className="contents group/row">
          <dt className="flex items-center gap-[var(--ct-space-2)] stat-label pt-[var(--ct-space-0_5)] group-hover/row:ct-text-body transition-colors ease-[var(--ct-ease)]">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shadow-[var(--ct-glow-dot)] bg-current",
                iconColorClass,
              )}
            />
            {label}
          </dt>
          <dd className="ct-text-body font-medium group-hover/row:ct-text-strong transition-colors ease-[var(--ct-ease)]">
            {values[key as "projection" | "trigger" | "action" | "impact"]}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (variant === "flat") {
    return <div className={className}>{rows}</div>;
  }

  return (
    <NestedPanel className={cn("p-[var(--ct-space-4)] group", className)}>{rows}</NestedPanel>
  );
}
