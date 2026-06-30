/**
 * Catalyst Card — canonical module-surface container for Hearst Connect.
 *
 * Token-only (all surfaces, spacing and motion come from `--ct-*` / the
 * `.ct-*` class layer in cockpit.css). This is the single UI source for Card —
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

/**
 * Sub-components below complete the shadcn-shaped Card API (description, content,
 * footer) so every Card surface resolves to this single Catalyst source.
 * Token-only; no hardcoded colours.
 */
export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("ct-metric-caption ct-text-muted", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ct-text-default", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-[var(--ct-space-6)] flex items-center gap-[var(--ct-space-3)]",
        className,
      )}
      {...props}
    />
  );
}
