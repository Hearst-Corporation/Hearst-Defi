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
