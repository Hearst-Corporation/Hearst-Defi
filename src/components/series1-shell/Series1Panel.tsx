import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Series 1 shell panel — FLAT by canon. Dense row panels are not cards: no
 * fill, no ring stack, just a hairline frame so a page never becomes a wall
 * of identical raised plaques (doctrine §4 "plaques identiques partout" /
 * anti cage-in-cage, and the standing "panneaux denses = PLATS" rule).
 * Depth belongs to the ONE hero object of the route, not to every block.
 *
 * DS convergence note: this stays a plain hairline <div> rather than delegating
 * to Catalyst <Card>. <Card>'s unlayered `.ct-glass-panel` forces `border:
 * 1px solid var(--ct-border)` and `box-shadow: none`, plus `.ct-card` padding —
 * they would override this panel's softer `border-(--ct-border-soft)` hairline
 * and inject unwanted padding (both rules load in shell-less Storybook too).
 * Render-stable prime: the panel keeps its own frame. The reusable convergence
 * for this file is one level down — `Series1RowBase`, the single shared row.
 */
export function Series1Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-(--ct-radius-xl) border border-(--ct-border-soft)",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Series1PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  // NOTE (DS convergence): kept as bespoke markup rather than delegating to
  // Catalyst <DashboardPanelHeader />. That primitive renders a different tree
  // (`dashboard-card-header` grid + `.eyebrow` + `.h3`/`.h2` title roles) which
  // does not reproduce this header's exact output (uppercase `text-xs`
  // tracking-0.14em muted title, hairline bottom border, px-5/py-4 rhythm).
  // Render-stable convergence prime: swapping it would move pixels. See the
  // target-map fallback clause ("garde le markup mais documente pourquoi").
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--ct-border-soft) px-5 py-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.14em] text-(--ct-text-muted) uppercase">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-(--ct-text-faint)">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Canonical Series 1 horizontal label/value row — the SINGLE implementation the
 * dashboard (`Series1DashboardRow`) and shell (`Series1Row`) presets both render.
 *
 * A row is inherently horizontal (label ⟷ value, optional hint under the value);
 * this is NOT Catalyst <Metric variant="nested">, which lays label ABOVE value in
 * a column (`.ct-metric-nested`) and would change the render. So the four former
 * copies converge on ONE primitive here, parameterised to reproduce each caller's
 * exact output rather than force one look onto both:
 *   - `size`     xs (dashboard, `text-xs`) | sm (shell, `text-sm`)
 *   - `divider`  self (dashboard: per-row `[&+&]:border-t`, first/last padding)
 *                | none (shell: separators drawn by the parent `.s1-row-list`)
 *   - `muted`    render the value quiet when the read did not resolve
 */
export function Series1RowBase({
  label,
  value,
  hint,
  size,
  divider,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  size: "xs" | "sm";
  divider: "self" | "none";
  muted?: boolean;
}) {
  const xs = size === "xs";
  return (
    <div
      className={cn(
        xs
          ? "flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]"
          : "flex items-center justify-between gap-4 px-5 py-4",
        divider === "self" &&
          "first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]",
      )}
    >
      <span
        className={cn(
          xs ? "min-w-0 text-[var(--ct-text-muted)]" : "text-sm text-(--ct-text-muted)",
        )}
        style={xs ? { fontSize: "var(--ct-text-xs)" } : undefined}
      >
        {label}
      </span>
      {xs ? (
        <span className="flex min-w-0 flex-col items-end text-right">
          <span
            className={cn(
              "font-semibold tabular-nums",
              muted
                ? "text-[var(--ct-text-faint)]"
                : "text-[var(--ct-text-strong)]",
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
      ) : (
        <span className="text-right text-sm font-semibold text-(--ct-text-strong) tabular-nums">
          {value}
          {hint ? (
            <span className="mt-0.5 block text-[10px] font-normal text-(--ct-text-faint)">
              {hint}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}

export function Series1Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Series1RowBase label={label} value={value} hint={hint} size="sm" divider="none" />
  );
}

export function Series1RowList({ children }: { children: ReactNode }) {
  return <div className="s1-row-list">{children}</div>;
}
