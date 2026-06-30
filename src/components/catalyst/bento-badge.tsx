/**
 * Catalyst BentoBadge — the canonical Hearst status chip (Portfolio bento look).
 *
 * Distinct from the generic Tailwind-Plus `catalyst/badge` (dot + color palette):
 * this is the uppercase, tinted bento chip used across the product/admin surfaces.
 * 100% `--ct-*` tokens (no raw hex / zinc / white-alpha): a single accent green via
 * `--ct-accent` for success/accent; `--ct-status-*` for warning/danger; neutral
 * via text/border tokens for default/brand.
 *
 * This is the canon; `src/components/ui/badge` is a thin compatibility wrapper that
 * re-exports `BentoBadge as Badge`. New code should import from here.
 */

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

export type BentoBadgeVariant = VariantProps<typeof bentoBadgeVariants>["variant"];

const bentoBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--ct-text-micro)] font-bold uppercase tracking-wider leading-none transition-colors whitespace-nowrap",
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

export interface BentoBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof bentoBadgeVariants> {}

export function BentoBadge({ className, variant, ...props }: BentoBadgeProps) {
  return (
    <span className={cn(bentoBadgeVariants({ variant }), className)} {...props} />
  );
}
