// Series 1 dashboard — section + card grammar.
//
// This module owns the SURFACE LADDER for the investor dashboard
// (docs/front-dashboard-zero-rebuild-canon.md §4). The rebuilt screen renders
// nothing that is not one of these primitives, so the ladder cannot drift
// panel by panel the way it did in `series1-shell`.
//
//   L1 shell   --ct-surface-page    the raised card SidebarLayout already draws
//   L2 card    --ct-surface-raised  RISES above L1 — this is the fix for the
//                                   inverted depth model (canon §0): the old
//                                   Series1Panel used a fill DARKER than its
//                                   own parent, so every card read as a hole.
//   L3 inset   --ct-surface-inset   RECESSES below L2 — wells, not content.
//
// No zinc, no `dark:`, no raw hex, no --ct-surface-card (#000). Colour comes
// from --ct-* tokens only; the app is dark-only.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Page root — one vertical rhythm for every section of the dashboard. */
export function Series1DashboardPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--ct-space-6)]">{children}</div>
  );
}

/**
 * A titled band of the page. The numeric index is deliberately dropped: the
 * old "01 / 02 / 03" chips made a three-block page read like a form, not like
 * an instrument register.
 */
export function Series1DashboardSection({
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
                className="m-0 mt-[var(--ct-space-1)] max-w-[68ch] leading-relaxed text-[var(--ct-text-muted)]"
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

/**
 * L2 content card — RISES above the page (canon §4). Never
 * `--ct-surface-card`: that token is #000000, i.e. darker than the
 * --ct-surface-page (#18181b) that contains it.
 */
export function Series1DashboardCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[var(--ct-radius-xl)]",
        "border border-[var(--ct-border-soft)] bg-[var(--ct-surface-raised)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card header — title, optional caption, optional trailing slot (provenance). */
export function Series1DashboardCardHeader({
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

/**
 * L3 inset — a well that RECESSES below the card. For chart grounds and
 * secondary panes only; never for primary content.
 */
export function Series1DashboardInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 bg-[var(--ct-surface-inset)]", className)}>{children}</div>
  );
}

/**
 * A label/value row. Separators are drawn by the row itself (`border-t` on
 * every row but the first) rather than by a `gap-px` grid whose gutter shows
 * through — that grid is what made the old KPI band read as a spreadsheet
 * (canon F2).
 */
export function Series1DashboardRow({
  label,
  value,
  hint,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Value did not resolve — render it quiet instead of authoritative. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]">
      <span
        className="min-w-0 text-[var(--ct-text-muted)]"
        style={{ fontSize: "var(--ct-text-xs)" }}
      >
        {label}
      </span>
      <span className="flex min-w-0 flex-col items-end text-right">
        <span
          className={cn(
            "font-semibold tabular-nums",
            muted ? "text-[var(--ct-text-faint)]" : "text-[var(--ct-text-strong)]",
          )}
          style={{ fontSize: "var(--ct-text-xs)" }}
        >
          {value}
        </span>
        {hint ? (
          <span
            className="mt-[var(--ct-space-1)] text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
