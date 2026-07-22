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
      {/* DS section head (design-system.html §08): a top hairline, then
          `sec-head` = optional index pill + 16px semibold title, then the
          description indented under it. The rule above each section is what
          gives the document its register — sections are separated by a filet,
          not by whitespace alone. */}
      {headed ? (
        <div className="mb-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-5)]">
          <div className="flex flex-wrap items-start justify-between gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-2)]">
            <div className="min-w-0">
              {title ? (
                <h2
                  className="m-0 font-semibold text-[var(--ct-text-strong)]"
                  style={{ fontSize: "var(--ct-text-sm)" }}
                >
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p
                  className="m-0 mt-[var(--ct-space-2)] max-w-[68ch] leading-relaxed text-[var(--ct-text-muted)]"
                  style={{ fontSize: "var(--ct-text-2xs)" }}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-[var(--ct-space-2)]">{actions}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * L2 content card — the Qatar cockpit `surfaceRaised`.
 *
 * The DS recipe is a zinc-900 fill plus a white/10 ring plus a large shadow:
 * the RING is what separates the card from the page, and the SHADOW is what
 * lifts it. Here both come from tokens (--ct-border, --ct-shadow-soft). The
 * first rebuild had the right fill but neither, which is why the cards read
 * flat and "gris sale" instead of raised. `--ct-border` is the repo's
 * white/10 hairline, so the ring is a token, not a new value.
 *
 * Never `--ct-surface-card`: that token is #000000, i.e. darker than the
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
        "bg-[var(--ct-surface-raised)] ring-1 ring-[var(--ct-border)]",
        "shadow-[var(--ct-shadow-elevated)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card header — the DS `panel-heading`: a 12px uppercase micro-label at
 * `tracking-[0.12em]` in the MUTED tone, over a faint hairline. The DS uses
 * the eyebrow register for panel titles, not a semibold body-size heading —
 * that is what makes a cockpit panel read as an instrument label rather than
 * as a document subtitle.
 */
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
    <div className="flex flex-wrap items-center justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-1)] border-b border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
      <div className="min-w-0">
        <h3
          className="m-0 font-semibold uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
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
 * L3 inset — the Qatar cockpit `surfaceSunken`.
 *
 * The DS recipe is `bg-zinc-950/50 + ring white/5`: a well is DARKER than the
 * card holding it, so it recedes. `--ct-surface-inset` (#15191C) is lighter
 * than `--ct-surface-raised`, which made every well read as a second raised
 * plate — the "cage-in-cage" effect. Mixing toward the page-deep ground gives
 * a true recess without inventing a value.
 */
export function Series1DashboardInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_55%,var(--ct-surface-page))]",
        className,
      )}
    >
      {children}
    </div>
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
