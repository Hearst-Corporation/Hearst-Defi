import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "ct-card glass-panel relative overflow-hidden group",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--ct-surface-0)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--ct-dur-slow)] pointer-events-none" />
      <div className="relative z-[var(--ct-z-base)]">{props.children}</div>
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
        "text-base font-bold tracking-tight text-[var(--ct-text-strong)] drop-shadow-[var(--ct-glow-subtle)]",
        className,
      )}
      {...props}
    />
  );
}
