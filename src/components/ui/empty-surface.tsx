import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type EmptySurfaceVariant = "widget" | "chart" | "inline";

export interface EmptySurfaceProps {
  /** Single calm headline. */
  message: string;
  detail?: string;
  /** widget = full module placeholder; chart = chart/donut slot; inline = nested inset (no chrome) */
  variant?: EmptySurfaceVariant;
  round?: boolean;
  className?: string;
  role?: "status" | "note";
  ariaLabel?: string;
  children?: ReactNode;
}

/**
 * Canonical empty / awaiting surface (DS §9).
 * Single component + `ct-empty-surface*` classes in cockpit.css.
 */
export function EmptySurface({
  message,
  detail,
  variant = "widget",
  round = false,
  className,
  role = variant === "chart" ? "note" : "status",
  ariaLabel,
  children,
}: EmptySurfaceProps) {
  return (
    <div
      role={role}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cn(
        "ct-empty-surface",
        variant === "widget" && "ct-empty-surface--widget",
        variant === "chart" && "ct-empty-surface--chart relative z-10",
        variant === "inline" && "ct-empty-surface--inline",
        round && "ct-empty-surface--round",
        className,
      )}
    >
      <p
        className={cn(
          "m-0",
          variant === "chart" && "body-xs ct-text-faint",
          variant !== "chart" && "body-sm ct-text-muted",
        )}
      >
        {message}
      </p>
      {detail ? (
        <p
          className={cn(
            "body-xs ct-text-faint m-0",
            variant === "widget" && "max-w-prose mt-1",
          )}
        >
          {detail}
        </p>
      ) : null}
      {children}
    </div>
  );
}
