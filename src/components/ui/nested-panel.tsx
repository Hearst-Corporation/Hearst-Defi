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

type RowProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

// Semantic wrappers below intentionally share the exact `.ct-proof-row` DOM/CSS.
// The class is implementation-only; callers choose DataRow / LegalMetadataRow / ProofRow.
function Row({
  label,
  children,
  className,
}: RowProps) {
  return (
    <div className={cn("ct-proof-row", className)}>
      <span className="ct-proof-row__label body-xs ct-text-muted">{label}</span>
      <span className="ct-proof-row__value body-sm mono tabular-nums ct-text-primary">
        {children}
      </span>
    </div>
  );
}

/**
 * Generic label/value row inside a NestedPanel.
 */
export function DataRow(props: RowProps) {
  return <Row {...props} />;
}

/**
 * Legal/compliance metadata row inside a NestedPanel.
 */
export function LegalMetadataRow(props: RowProps) {
  return <Row {...props} />;
}

/**
 * Label/value row inside a NestedPanel (proof, evidence, methodology fields).
 * Backwards-compatible alias while callers migrate to semantic row names.
 */
export function ProofRow(props: RowProps) {
  return <Row {...props} />;
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

type MetricGridProps = {
  children: React.ReactNode;
  className?: string;
  /** Max column count at large breakpoints (2, 3, or 4). */
  columns?: 2 | 3 | 4;
};

/** Responsive semantic grid for nested Metric cells. Renders `.ct-nested-kpi-grid`. */
export function MetricGrid({
  children,
  className,
  columns = 3,
}: MetricGridProps) {
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

/**
 * Backwards-compatible alias. Prefer MetricGrid for new semantic metric grids.
 */
export function NestedKpiGrid(props: MetricGridProps) {
  return <MetricGrid {...props} />;
}
