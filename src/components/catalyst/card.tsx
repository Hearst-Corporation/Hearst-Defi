/**
 * Catalyst Card — canonical module-surface container for Hearst Connect.
 *
 * Token-only (all surfaces, spacing and motion come from `--ct-*` / the
 * `.ct-*` class layer in cockpit.css). This is the canon: `src/components/ui/card`
 * is a thin compatibility wrapper that re-exports these symbols. New code should
 * import Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter
 * from `@/components/catalyst/card`.
 *
 * `glass` (default) renders the opaque graphite module surface (legacy class name
 * `.ct-glass-panel`, no real frosted glass); `flat` keeps the same opaque fill for
 * dense lists/tables (anti cage-in-cage). Dark mode only — no `dark:` modifiers.
 */

import { cn } from "@/lib/cn";

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
  /** `glass` (default) = opaque graphite module surface (legacy class `.ct-glass-panel`);
   *  `flat` = same opaque fill, for dense lists/tables (anti cage-in-cage). */
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
      className={cn(
        "mb-[var(--ct-space-6)] flex items-start justify-between gap-[var(--ct-space-3)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("h3 ct-text-strong", className)} {...props} />;
}

/** Shadcn-shaped body slot — padding lives on `.ct-card`; this is a layout wrapper only. */
export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-description"
      className={cn("ct-metric-caption ct-text-muted", className)}
      {...props}
    />
  );
}

/** Shadcn-shaped content slot — use inside `.ct-card` (surface padding is on the shell). */
export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card-content" className={cn(className)} {...props} />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}
