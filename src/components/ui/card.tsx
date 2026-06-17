import { cn } from "@/lib/cn";

/**
 * Card — canonical L3 module surface (graphite family, see DESIGN_SYSTEM
 * §UI-Hierarchy / Surface taxonomy). Shares background/border/radius/blur with
 * `pf-cockpit-panel`.
 *
 * `hoverOverlay` default stays `true` for now. Per-call-site cleanup is in
 * progress: clearly **static informational** cards opt out with
 * `hoverOverlay={false}`; **clickable** cards may also opt out when they ship
 * custom hover chrome (border/accent) instead of the default glass overlay.
 * A global default flip is deferred until every call-site is classified.
 */
export function Card({
  className,
  contentClassName,
  hoverOverlay = true,
  density = "default",
  material = "glass",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hoverOverlay?: boolean;
  /** Layout/spacing on the inner content shell (`.ct-z-base`). Use when stacking
   *  CardTitle + body — flex/grid on the outer `.ct-card` does not reach children. */
  contentClassName?: string;
  density?: "default" | "compact";
  /** `glass` (default) = graphite module surface; `flat` = opaque, no frost —
   *  for dense lists/tables where glass-on-glass would cage-in-cage. */
  material?: "glass" | "flat";
}) {
  return (
    <div
      className={cn(
        "ct-card ct-glass-panel relative overflow-hidden",
        /* SHELL STABILISATION (2026-06-15): the inline `backdrop-blur` added by the
           glass pass put a backdrop-filter on EVERY glass Card across the app —
           backdrop-filter creates a stacking context + containing block per Card,
           which let content/rails slip under the panels (overlay regression).
           Removed: .ct-glass-panel already provides the surface via tokens, with no
           backdrop-filter. This reverts the Card primitive to its committed (stable)
           behaviour. Re-introduce frost only on single-level surfaces, never on the
           shared Card primitive. */
        material === "flat" && "ct-glass-panel--flat",
        density === "compact" && "ct-card--compact",
        hoverOverlay && "group",
        className,
      )}
      {...props}
    >
      {hoverOverlay ? (
        <div className="absolute inset-0 ct-overlay-surface0 opacity-0 group-hover:opacity-100 ct-transition-opacity-slow pointer-events-none" />
      ) : null}
      <div className={cn("relative ct-z-base", contentClassName)}>{children}</div>
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-[var(--ct-space-6)] flex items-start justify-between gap-[var(--ct-space-3)]", className)}
      {...props}
    />
  );
}

/**
 * Card title. Renders as <h3> and binds to the canonical `.h3` typographic
 * role (base / 700 / tracking-tight) so a card title never dominates a section
 * title (`.h2` = xl / 700). Size/weight come from Tailwind v4 utilities
 * resolved through the `@theme` block (text-base → 1rem, font-bold → 700,
 * tracking-tight → --tracking-tight); the strong text color + subtle accent
 * glow preserve the premium card chrome. No raw hex / no Tailwind default palette.
 */
export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "h3 ct-text-strong ct-drop-glow-subtle",
        className,
      )}
      {...props}
    />
  );
}
