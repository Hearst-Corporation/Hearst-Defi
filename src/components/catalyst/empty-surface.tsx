/**
 * Catalyst EmptySurface — canonical honest empty-state for Hearst Connect.
 *
 * Token-only (`.ct-empty-surface*` class layer + `--ct-*` vars). This is the
 * canon; `src/components/ui/empty-surface` is a thin compatibility wrapper that
 * re-exports these symbols. New code should import EmptySurface from
 * `@/components/catalyst/empty-surface`.
 *
 * Three variants — `widget` (default, card slot), `chart` (overlay on a plot),
 * `inline` (compact). Optional `link` call-to-action, optional `live` aria-live
 * region. Renders a real, honest "nothing here yet" surface — never a fake value.
 */

import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/cn";

export type EmptySurfaceVariant = "widget" | "chart" | "inline";

export interface EmptySurfaceProps {
  message: string;
  detail?: string;
  variant?: EmptySurfaceVariant;
  round?: boolean;
  className?: string;
  role?: "status" | "note";
  ariaLabel?: string;
  children?: ReactNode;
  live?: boolean;
  link?: { label: string; href: string; ariaLabel?: string };
}

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
          variant !== "chart" && "body-sm ct-text-faint",
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
          className="body-xs ct-text-muted ct-text-primary-hover transition-colors ease-[var(--ct-ease)] underline underline-offset-2 decoration-[var(--ct-border)] mt-[var(--ct-space-1)]"
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
