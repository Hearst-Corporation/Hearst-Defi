import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 ct-text-micro-size mono uppercase tracking-[var(--ct-tracking-wide)] leading-tight transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--ct-border)] ct-surface-1 ct-text-muted",
        success:
          "border-[color-mix(in_srgb,var(--ct-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] ct-text-accent",
        warning:
          "border-[var(--ct-status-warning-border)] ct-status-warning-bg ct-status-warning",
        danger:
          "border-[var(--ct-status-danger-border)] ct-status-danger-bg ct-status-danger",
        accent:
          "border-[var(--ct-border-strong)] ct-surface-2 ct-text-strong",
        brand:
          "border-[var(--ct-border-strong)] ct-surface-2 ct-text-strong",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
