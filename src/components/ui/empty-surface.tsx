import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type EmptySurfaceVariant = "widget" | "chart" | "inline";

export interface EmptySurfaceProps {
  /** Single calm headline. */
  message: string;
  detail?: string;
  /** widget = full module placeholder; chart = chart/donut slot; inline = table cell / panel inset */
  variant?: EmptySurfaceVariant;
  round?: boolean;
  className?: string;
  role?: "status" | "note";
  ariaLabel?: string;
  children?: ReactNode;
}

/**
 * Canonical empty / awaiting surface (DS §9).
 * Replaces ad-hoc `.ct-empty-state` (dashed), raw `Card` shells, and divergent
 * `pf-empty-*` markup. Dashed borders are reserved for `.ct-dropzone` only.
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
        variant === "widget" && "pf-empty-widget",
        variant === "chart" && "ct-empty-surface--chart pf-empty-chart",
        variant === "inline" && "ct-empty-surface--inline",
        round && "ct-empty-surface--round pf-empty-chart--round",
        className,
      )}
    >
      <p className={cn(variant === "chart" ? "body-xs ct-text-faint" : "body-sm ct-text-muted")}>
        {message}
      </p>
      {detail ? (
        <p className="body-xs ct-text-faint max-w-prose mt-1">{detail}</p>
      ) : null}
      {children}
    </div>
  );
}
