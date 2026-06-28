/**
 * Catalyst CockpitButton — the canonical Hearst cockpit button.
 *
 * Distinct from the generic Tailwind-Plus `catalyst/button` (rounded-lg, color
 * palette, href discrimination): this is the pill (`rounded-full`), semantic-
 * variant button used across the product/admin cockpit. 100% `--ct-*` tokens
 * (accent fill, token spacing, `ct-focus-ring` = accent — never a raw blue ring).
 *
 * This is the canon; `src/components/ui/button` is a thin compatibility wrapper
 * that re-exports `CockpitButton as Button`. New code should import from here.
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

export const cockpitButtonVariants = cva(
  "inline-flex items-center justify-center gap-[var(--ct-space-2)] rounded-full text-sm font-medium ct-transition-base disabled:opacity-[var(--ct-opacity-50)] disabled:cursor-not-allowed focus-visible:outline-none ct-focus-ring ct-press",
  {
    variants: {
      variant: {
        primary: "font-bold ct-bg-accent ct-text-on-accent ct-bg-accent-strong-hover",
        secondary:
          "ct-surface-0 border ct-bc-soft ct-text-primary hover:ct-surface-2 ct-bc-strong-hover hover:ct-text-strong",
        ghost: "ct-text-muted hover:ct-surface-1 hover:ct-text-strong",
        danger:
          "border ct-bc-danger ct-status-danger-bg ct-status-danger hover:ct-status-danger-bg",
      },
      size: {
        sm: "h-5 px-[var(--ct-space-2)] ct-text-micro-size",
        md: "h-7 px-[var(--ct-space-3)] ct-text-xs-size",
        lg: "h-9 px-[var(--ct-space-4)] text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface CockpitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof cockpitButtonVariants> {
  asChild?: boolean;
}

export function CockpitButton({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  "aria-disabled": ariaDisabledProp,
  ...rest
}: CockpitButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Propagate aria-disabled so AT (NVDA/JAWS/VoiceOver) reliably announce the
  // disabled state. An explicit aria-disabled from the caller takes precedence.
  const ariaDisabled = ariaDisabledProp ?? (disabled ? true : undefined);
  return (
    <Comp
      className={cn(cockpitButtonVariants({ variant, size }), className)}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      {...rest}
    />
  );
}
