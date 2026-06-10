import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ct-text-micro-size font-medium uppercase ct-tracking-wide ct-leading-none backdrop-blur-md ct-shadow-soft transition-colors",
  {
    variants: {
      variant: {
        default:
          "ct-bc-base ct-surface-1 ct-text-muted",
        success:
          "ct-bc-success ct-status-success-bg ct-status-success",
        warning:
          "ct-bc-warning ct-status-warning-bg ct-status-warning",
        danger:
          "ct-bc-danger ct-status-danger-bg ct-status-danger",
        accent:
          "ct-bc-strong ct-surface-2 ct-text-strong",
        brand:
          "ct-bc-strong ct-surface-2 ct-text-strong",
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
