import type { ReactNode } from "react";

import Link from "next/link";

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
  /**
   * Async-data-awaiting semantics: wraps the surface in
   * `<div role="status" aria-live="polite" aria-atomic="true">` (DS §9.3).
   * Also forces `h-full` on the widget variant to fill its container.
   */
  live?: boolean;
  /** Optional CTA link rendered after any children (DS §9.3). */
  link?: { label: string; href: string; ariaLabel?: string };
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
  live = false,
  link,
}: EmptySurfaceProps) {
  const surface = (
    <div
      role={live ? "note" : role}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={cn(
        "ct-empty-surface",
        variant === "widget" && "ct-empty-surface--widget",
        variant === "chart" && "ct-empty-surface--chart relative z-10",
        variant === "inline" && "ct-empty-surface--inline",
        round && "ct-empty-surface--round",
        live && variant === "widget" && "h-full",
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
            variant === "widget" && "max-w-prose mt-[var(--ct-space-1)]",
          )}
        >
          {detail}
        </p>
      ) : null}
      {children}
      {link ? (
        <Link
          href={link.href}
          aria-label={link.ariaLabel ?? link.label}
          className="body-xs ct-text-muted hover:ct-text-primary transition-colors ease-[var(--ct-ease)] underline underline-offset-2 decoration-[var(--ct-border)] mt-[var(--ct-space-1)]"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );

  if (live) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true">
        {surface}
      </div>
    );
  }

  return surface;
}
