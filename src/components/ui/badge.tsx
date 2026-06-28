import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

// Bento chip (Portfolio canon) — tinted border + fill + text per status.
// 100% --ct-* tokens (no raw hex / zinc / white-alpha): single accent green via
// --ct-accent for success/accent; --ct-status-* for warning/danger; neutral via
// text/border tokens for default/brand. API unchanged (28 consumers).
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[length:var(--ct-text-nano)] font-bold uppercase tracking-wider leading-none transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
        success:
          "border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] text-[var(--ct-accent)]",
        warning:
          "border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] text-[var(--ct-status-warning)]",
        danger:
          "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]",
        accent:
          "border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] text-[var(--ct-accent)]",
        brand:
          "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-body)]",
        flat: "border-transparent bg-transparent shadow-none backdrop-blur-none font-medium normal-case tracking-normal px-0 py-0 gap-1",
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
