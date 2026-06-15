"use client";

import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// BatchActionButton
// ---------------------------------------------------------------------------

interface BatchActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional visual variant — defaults to "default". */
  variant?: "default" | "danger";
}

/**
 * A single action slot inside `BatchSelectionBar`.
 *
 * Usage:
 * ```tsx
 * <BatchActionButton onClick={handleApprove}>Approve</BatchActionButton>
 * <BatchActionButton variant="danger" onClick={handleDelete}>Delete</BatchActionButton>
 * ```
 */
export function BatchActionButton({
  className,
  variant = "default",
  children,
  disabled,
  ...rest
}: BatchActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        // Base
        "inline-flex items-center gap-1.5 rounded-full",
        "px-3 py-1 body-xs font-medium",
        "transition-[background-color,border-color,color,opacity]",
        "duration-[var(--ct-dur-base)]",
        "disabled:opacity-[var(--ct-opacity-40)] disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
        "active:scale-[0.97]",
        // Variants
        variant === "default" &&
          "border border-[var(--ct-border-soft)] ct-surface-1 ct-text-primary hover:ct-surface-2 hover:border-[var(--ct-border-strong)] hover:ct-text-strong",
        variant === "danger" &&
          "border border-[var(--ct-status-danger-border)] ct-status-danger-bg ct-status-danger hover:ct-status-danger-bg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
