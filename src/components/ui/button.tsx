import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-[background-color,border-color,color,transform,opacity] duration-[var(--ct-dur-base)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)] active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "font-bold bg-[var(--ct-accent)] text-[var(--ct-bg-deep)] hover:bg-[var(--ct-accent-strong)] shadow-[0_0_1rem_color-mix(in_srgb,var(--ct-accent)_25%,transparent)]",
        secondary:
          "ct-surface-0 backdrop-blur-xl border border-[var(--ct-border-soft)] ct-text-primary hover:ct-surface-2 hover:border-[var(--ct-border-strong)] hover:ct-text-strong",
        ghost:
          "ct-text-muted hover:ct-surface-1 hover:ct-text-strong",
        danger:
          "border border-[var(--ct-status-danger-border)] ct-status-danger-bg ct-status-danger hover:ct-status-danger-bg",
      },
      size: {
        sm: "h-5 px-2 text-micro",
        md: "h-7 px-3 text-xs",
        lg: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  disabled,
  "aria-disabled": ariaDisabledProp,
  ...rest
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // Propagate aria-disabled so AT (NVDA/JAWS/VoiceOver) reliably announce the
  // disabled state. An explicit aria-disabled from the caller takes precedence.
  const ariaDisabled = ariaDisabledProp ?? (disabled ? true : undefined);
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      {...rest}
    />
  );
}
