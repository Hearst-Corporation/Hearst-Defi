import { cn } from "@/lib/cn";

/**
 * Card — canonical L3 module surface (graphite family, see DESIGN_SYSTEM
 * §UI-Hierarchy / Surface taxonomy). Shares background/border/radius/blur with
 * `pf-cockpit-panel`.
 *
 * `hoverOverlay` default stays `true` for now. Per-call-site cleanup is in
 * progress: clearly **static informational** cards opt out with
 * `hoverOverlay={false}`; **clickable / selectable** cards keep the overlay.
 * A global default flip is deferred until every call-site is classified.
 */
export function Card({
  className,
  hoverOverlay = true,
  density = "default",
  material = "glass",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hoverOverlay?: boolean;
  density?: "default" | "compact";
  /** `glass` (default) = graphite module surface; `flat` = opaque, no frost —
   *  for dense lists/tables where glass-on-glass would cage-in-cage. */
  material?: "glass" | "flat";
}) {
  return (
    <div
      className={cn(
        "ct-card ct-glass-panel relative overflow-hidden",
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
      <div className="relative ct-z-base">{children}</div>
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-5 flex items-start justify-between gap-3", className)}
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
