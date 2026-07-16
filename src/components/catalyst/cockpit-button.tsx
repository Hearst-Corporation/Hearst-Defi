/**
 * Catalyst CockpitButton — the canonical Hearst product button.
 *
 * 100% `--ct-*` tokens. Distinct from deprecated `catalyst/button` (Tailwind Plus).
 * Supports optional `href` (Next.js Link) for navigation actions.
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { Link } from "./link";

export const cockpitButtonVariants = cva(
  "inline-flex items-center justify-center gap-[var(--ct-space-2)] text-sm font-medium ct-transition-base disabled:opacity-[var(--ct-opacity-50)] disabled:cursor-not-allowed focus-visible:outline-none ct-focus-ring ct-press",
  {
    variants: {
      variant: {
        primary:
          "font-bold ct-bg-accent ct-text-on-accent ct-bg-accent-strong-hover",
        secondary:
          "ct-surface-0 border ct-bc-soft ct-text-primary ct-surface-2-hover ct-bc-strong-hover ct-text-strong-hover",
        quiet:
          "border-transparent bg-transparent ct-text-muted ct-text-strong-hover ct-surface-1-hover",
        outline:
          "border ct-bc-soft bg-transparent ct-text-primary ct-surface-1-hover ct-text-strong-hover",
        ghost: "ct-text-muted ct-surface-1-hover ct-text-strong-hover border-transparent",
        danger:
          "border ct-bc-danger ct-status-danger-bg ct-status-danger",
        destructive:
          "border ct-bc-danger ct-status-danger-bg ct-status-danger",
      },
      shape: {
        pill: "rounded-full",
        rect: "rounded-lg",
      },
      size: {
        sm: "h-5 px-[var(--ct-space-2)] ct-text-micro-size",
        md: "h-7 px-[var(--ct-space-3)] ct-text-xs-size",
        lg: "h-9 px-[var(--ct-space-4)] text-sm px-4 py-2.5",
        icon: "size-8 p-0",
      },
    },
    compoundVariants: [
      { size: "lg", shape: "rect", className: "h-auto min-h-9" },
    ],
    defaultVariants: {
      variant: "secondary",
      shape: "pill",
      size: "md",
    },
  },
);

export interface CockpitButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof cockpitButtonVariants> {
  asChild?: boolean;
  href?: string;
}

export function CockpitButton({
  className,
  variant,
  shape,
  size,
  asChild = false,
  href,
  disabled,
  "aria-disabled": ariaDisabledProp,
  children,
  ...rest
}: CockpitButtonProps) {
  const classes = cn(cockpitButtonVariants({ variant, shape, size }), className);
  const ariaDisabled = ariaDisabledProp ?? (disabled ? true : undefined);

  if (href && !disabled) {
    // `href` was already destructured out of the props above, so `rest` never
    // contains it at runtime — this cast just types `rest` as Link props so
    // the spread below type-checks (Link doesn't accept `disabled`/etc as-is).
    const linkRest = rest as Omit<React.ComponentPropsWithoutRef<typeof Link>, "href">;
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={ariaDisabled}
        {...linkRest}
      >
        {children}
      </Link>
    );
  }

  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={classes}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      {...rest}
    >
      {children}
    </Comp>
  );
}
