import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ct-text-micro-size font-bold uppercase ct-tracking-wide ct-leading-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "ct-bc-base ct-surface-1 ct-text-muted backdrop-blur-md ct-shadow-soft",
        success:
          "ct-bc-success ct-status-success-bg ct-status-success backdrop-blur-md ct-shadow-soft",
        warning:
          "ct-bc-warning ct-status-warning-bg ct-status-warning backdrop-blur-md ct-shadow-soft",
        danger:
          "ct-bc-danger ct-status-danger-bg ct-status-danger backdrop-blur-md ct-shadow-soft",
        accent:
          "ct-bc-strong ct-surface-2 ct-text-strong backdrop-blur-md ct-shadow-soft",
        brand:
          "ct-bc-strong ct-surface-2 ct-text-strong backdrop-blur-md ct-shadow-soft",
        flat:
          "border-transparent bg-transparent shadow-none backdrop-blur-none font-medium normal-case tracking-normal px-0 py-0 gap-1",
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
