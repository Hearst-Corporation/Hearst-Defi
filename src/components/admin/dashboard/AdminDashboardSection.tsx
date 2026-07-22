// Admin dashboard — section + card grammar.
//
// Owns the SURFACE LADDER for the operator dashboard
// (docs/front-dashboard-zero-rebuild-canon.md §4), the same ladder the investor
// dashboard uses, at operator density:
//
//   L1 shell   --ct-surface-page    the raised card SidebarLayout already draws
//   L2 card    --ct-surface-raised  RISES above L1. The retired board used
//                                   BentoPanel → .ct-glass-panel →
//                                   --ct-surface-card (#000000), i.e. a pure
//                                   black slab punched into a graphite page
//                                   (canon §0/F1). That is what this replaces.
//   L3 inset   --ct-surface-inset   RECESSES below L2 — wells only.
//
// No zinc, no `dark:`, no raw hex, no --ct-surface-card. Accent is a signal,
// never a material.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Page root — one vertical rhythm for the whole operator surface. */
export function AdminDashboardStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--ct-space-6)]">{children}</div>
  );
}

/** A titled band of the operator page. */
export function AdminDashboardSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headed = Boolean(title || description || actions);
  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      {headed ? (
        <div className="mb-[var(--ct-space-4)] flex flex-wrap items-start justify-between gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-2)]">
          <div className="min-w-0">
            {title ? (
              <h2
                className="m-0 font-semibold tracking-tight text-[var(--ct-text-strong)]"
                style={{ fontSize: "var(--ct-text-xl-fixed)" }}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                className="m-0 mt-[var(--ct-space-1)] max-w-[72ch] leading-relaxed text-[var(--ct-text-muted)]"
                style={{ fontSize: "var(--ct-text-xs)" }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-[var(--ct-space-2)]">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** L2 operator card — RISES above the page. `min-w-0` per admin-visual-frame. */
export function AdminDashboardCard({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[var(--ct-radius-xl)]",
        "border border-[var(--ct-border-soft)] bg-[var(--ct-surface-raised)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Card header — title, optional caption, optional trailing slot. */
export function AdminDashboardCardHeader({
  title,
  caption,
  trailing,
}: {
  title: string;
  caption?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-1)] border-b border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
      <div className="min-w-0">
        <h3
          className="m-0 font-semibold text-[var(--ct-text-strong)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {title}
        </h3>
        {caption ? (
          <p
            className="m-0 mt-[var(--ct-space-1)] leading-relaxed text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            {caption}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

/** L3 inset — a well that recesses below the card. */
export function AdminDashboardInset({
  children,
  className,
  role,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn("min-w-0 bg-[var(--ct-surface-inset)]", className)}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
