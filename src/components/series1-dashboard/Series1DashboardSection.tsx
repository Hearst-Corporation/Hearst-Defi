import type { ReactNode } from "react";

import { Series1RowBase } from "@/components/series1-shell/Series1Panel";
import { cn } from "@/lib/cn";
import {
  surfaceClassName,
  type SurfaceVariant,
} from "@/lib/ui/surface-classes";

export function Series1DashboardPage({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        surfaceClassName("canvas"),
        // `relative isolate` scopes the halo stacking context to this page.
        "relative isolate flex w-full flex-col gap-[var(--ct-space-5)]",
      )}
    >
      {/* Ambient halo — the ROOT fix for the dead-flat ground. The light was
          turned off at the token level (--ct-ambient-glow-bg-*: 0%) during the
          anti-cage passes; DS_SHELL_CONTRACT §5 sanctions exactly one ambient
          glow at shell level, and the validated direction is "lumière + verre
          sombre — assombrir le verre, PAS retirer la lumière". Derived from
          --ct-accent-ambient (a token), no new hex. Cards are opaque, so the
          halo lives in the gutters — never behind a figure. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem]"
        style={{
          background:
            "radial-gradient(58% 46% at 50% 0%, color-mix(in srgb, var(--ct-accent-ambient) 22%, transparent) 0%, color-mix(in srgb, var(--ct-accent-ambient) 9%, transparent) 40%, transparent 72%)",
        }}
      />
      {children}
    </div>
  );
}

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
        <div className="mb-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
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

export function Series1DashboardCard({
  variant = "primary",
  children,
  className,
}: {
  variant?: Exclude<SurfaceVariant, "canvas" | "hero" | "inset">;
  children: ReactNode;
  className?: string;
}) {
  // DS convergence — OUTER CONTAINER: kept as a plain <div> painted by
  // `surfaceClassName`, NOT delegated to Catalyst <Card>. This is the target-map's
  // documented fallback ("garde le markup mais documente pourquoi — rendu stable
  // prime"), and the reason is structural, not stylistic:
  //
  //   <Card> forces its surface through `.ct-glass-panel` (`border`, `box-shadow:
  //   none`) and `.ct-card` (`padding`) — both UNLAYERED in cockpit.css, so they
  //   beat Tailwind utility classes AND load in shell-less Storybook. The Series1
  //   depth here is carried by utility classes: `ring-1` and `shadow-*` are BOTH
  //   box-shadow, and `.ct-glass-panel { box-shadow: none }` would erase the ring +
  //   elevation, while its `border` would add a second frame and `.ct-card` padding
  //   would double the consumers' own inset padding. Neutralising all of that
  //   requires reproducing the entire ring/shadow/bg inline (one `box-shadow`
  //   value), which abandons `surfaceClassName` as the className authority and
  //   invites drift. So Card cannot be the outer primitive here without moving
  //   pixels. The convergence that IS pixel-safe lives one level down: the row
  //   primitive (Series1RowBase) is now the single shared Series1 row.
  return (
    <div className={surfaceClassName(variant, className)}>{children}</div>
  );
}

export function Series1DashboardCardHeader({
  title,
  caption,
  trailing,
}: {
  title: string;
  caption?: ReactNode;
  trailing?: ReactNode;
}) {
  // NOTE (DS convergence): kept as bespoke markup rather than delegating to
  // Catalyst <DashboardPanelHeader />. That primitive emits a different tree
  // (`dashboard-card-header` grid, `.eyebrow`, `.h3` title role, provenance strip)
  // and would not reproduce this header's exact render (uppercase `text-2xs`
  // tracking-0.12em muted title, `text-nano` faint caption, hairline bottom border,
  // px-5/py-3 rhythm). Render-stable convergence prime: swapping it moves pixels.
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

export function Series1DashboardInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // Same reasoning as Series1DashboardCard: the `inset` well is painted with
  // `ring-inset` + `shadow-(--ct-shadow-inset)` (both box-shadow), which Catalyst
  // <Card>'s unlayered `.ct-glass-panel { box-shadow: none }` would erase. Kept a
  // plain <div> so the recessed well renders unchanged.
  return (
    <div className={surfaceClassName("inset", className)}>{children}</div>
  );
}

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
  // DS convergence: the four former row copies now share ONE primitive,
  // `Series1RowBase`. This is the dashboard preset — `size="xs"` (text-xs) with
  // self-drawn separators (`divider="self"`: per-row `[&+&]:border-t`, first/last
  // padding). Same public props, same render.
  return (
    <Series1RowBase
      label={label}
      value={value}
      hint={hint}
      muted={muted}
      size="xs"
      divider="self"
    />
  );
}
