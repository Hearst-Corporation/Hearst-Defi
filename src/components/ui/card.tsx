import { cn } from "@/lib/cn";

/**
 * Card — canonical L3 module surface (graphite family, see DESIGN_SYSTEM
 * §UI-Hierarchy / Surface taxonomy). Shares background/border/radius/blur with
 * `pf-cockpit-panel`.
 *
 * `hoverOverlay` is **opt-in** (default `false`). A static container must not
 * shimmer on hover — pass `hoverOverlay` only when the whole Card is genuinely
 * clickable (wraps a link / carries onClick). Audited 2026-06-13: no Card in
 * the app was relying on the overlay for affordance, so the prior `true`
 * default only added decorative noise to static cards.
 */
export function Card({
  className,
  hoverOverlay = false,
  density = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hoverOverlay?: boolean;
  density?: "default" | "compact";
}) {
  return (
    <div
      className={cn(
        "ct-card ct-glass-panel relative overflow-hidden",
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
      className={cn("mb-8 flex items-start justify-between gap-4", className)}
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
