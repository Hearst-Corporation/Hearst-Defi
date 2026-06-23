import { cn } from "@/lib/cn";

interface NestedPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "borderless";
}

export function NestedPanel({
  children,
  className,
  variant = "default",
  ...props
}: NestedPanelProps) {
  return (
    <div
      className={cn(
        "ct-nested-panel",
        variant === "borderless" && "ct-nested-panel--borderless",
        className,
      )}
      {...props}
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

export function DataRow(props: RowProps) {
  return <Row {...props} />;
}

export function LegalMetadataRow(props: RowProps) {
  return <Row {...props} />;
}

export function ProofRow(props: RowProps) {
  return <Row {...props} />;
}

type MetricGridProps = {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
};

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

