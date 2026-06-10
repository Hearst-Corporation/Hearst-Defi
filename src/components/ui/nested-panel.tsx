import { cn } from "@/lib/cn";

/**
 * Calm inset panel inside a parent Card or dash-cell. Replaces ad-hoc
 * `ct-panel-inset rounded-lg border px-* py-*` copies. Parent owns provenance.
 */
export function NestedPanel({
  children,
  className,
  role,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn("ct-nested-panel", className)}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/**
 * Label/value row inside a NestedPanel (proof, evidence, methodology fields).
 */
export function ProofRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ct-proof-row", className)}>
      <span className="ct-proof-row__label body-xs ct-text-muted">{label}</span>
      <span className="ct-proof-row__value body-sm mono tabular-nums ct-text-primary">
        {children}
      </span>
    </div>
  );
}

/** Status callout inside a parent card or dash-cell (alerts, pending states). */
export function NestedCallout({
  children,
  className,
  role = "status",
}: {
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
}) {
  return (
    <div className={cn("ct-nested-callout", className)} role={role}>
      {children}
    </div>
  );
}

/** Responsive grid for nested Metric cells (2 → 3 → 4 columns). */
export function NestedKpiGrid({
  children,
  className,
  columns = 3,
}: {
  children: React.ReactNode;
  className?: string;
  /** Max column count at large breakpoints (2, 3, or 4). */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "ct-nested-kpi-grid",
        columns === 4 && "ct-nested-kpi-grid--4",
        className,
      )}
    >
      {children}
    </div>
  );
}
