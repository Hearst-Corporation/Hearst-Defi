import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border border-border bg-surface-raised text-muted",
        accent: "bg-accent-muted text-accent",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-danger/15 text-danger",
        info: "bg-info/15 text-info",
        outline: "border border-border-subtle text-subtle",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function ProvenanceBadge({
  source,
  className,
}: {
  source: "live" | "oracle" | "attested" | "estimated" | "manual" | "stale";
  className?: string;
}) {
  const labels = {
    live: "Live",
    oracle: "Oracle",
    attested: "Attested",
    estimated: "Estimated",
    manual: "Manual",
    stale: "Stale",
  } as const;

  const variants: Record<typeof source, BadgeProps["variant"]> = {
    live: "accent",
    oracle: "info",
    attested: "success",
    estimated: "warning",
    manual: "default",
    stale: "danger",
  };

  return (
    <Badge variant={variants[source]} className={className}>
      {labels[source]}
    </Badge>
  );
}
