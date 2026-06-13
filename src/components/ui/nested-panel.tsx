import { cn } from "@/lib/cn";

/**
 * Calm inset panel inside a parent Card or dash-cell. Replaces ad-hoc
 * `ct-panel-inset rounded-lg border px-* py-*` copies. Parent owns provenance.
 */
export function NestedPanel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ct-nested-panel", className)} {...props}>
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

