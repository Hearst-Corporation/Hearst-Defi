// Series 1 dashboard — section + card grammar.
//
// This module owns the SURFACE LADDER for the investor dashboard
// (docs/front-dashboard-zero-rebuild-canon.md §4). The rebuilt screen renders
// nothing that is not one of these primitives, so the ladder cannot drift
// panel by panel the way it did in `series1-shell`.
//
//   L1 shell   --ct-surface-page    the raised card SidebarLayout already draws
//   L2 card    --ct-bg-deep mix     a deep, clean cockpit panel — separated
//                                   from L1 by ring + shadow, not by being a
//                                   LIGHTER fill (that read as flat/"gris sale").
//   L3 inset   deeper --ct-bg-deep  RECESSES below L2 — wells, not content.
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
 * L2 content card — the Qatar cockpit `surfaceRaised`, rendered as a cockpit
 * panel rather than a lightened plate.
 *
 * Separation from the page comes from the RING (--ct-border, white/10) and
 * the SHADOW (--ct-shadow-elevated) — never from the fill being lighter than
 * --ct-surface-page. A fill mixed toward --ct-bg-deep is what reads as a
 * deep, clean cockpit panel; --ct-surface-raised (a page tint lightened by
 * text-strong) is what read as "gris sale" / flat.
 *
 * Never --ct-surface-card (#000000, pure black, no depth cue left for the
 * wells inside it to recede further).
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
        "bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))]",
        "ring-1 ring-[var(--ct-border)] shadow-[var(--ct-shadow-elevated)]",
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
 * than the card, which made every well read as a second raised plate — the
 * "cage-in-cage" effect. A deeper mix toward --ct-bg-deep than the card uses
 * (80% here vs. the card's 65%) keeps the well legibly darker without
 * touching --ct-surface-card (#000, no room left to recede further).
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
        "min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_80%,var(--ct-surface-page))]",
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
