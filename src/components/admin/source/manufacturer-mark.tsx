import { cn } from "@/lib/cn";
import type { Manufacturer } from "@/lib/telegram/manufacturer-catalog";
import { manufacturerBrand } from "@/lib/telegram/manufacturer-logos";

/**
 * ManufacturerMark — a compact, square brand mark for the start of a machine
 * row: the maker's initial in its official brand colour. Used inline before the
 * model because the official wordmarks are horizontal (they would not fit a
 * row). Token-driven sizing so it sits on the `ct-metric-value` baseline.
 */
export function ManufacturerMark({
  manufacturer,
  size = 18,
  className,
}: {
  manufacturer: Manufacturer;
  size?: number;
  className?: string;
}) {
  const brand = manufacturerBrand(manufacturer);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[5px] font-bold leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.56),
        // Brand colour as a tinted chip — the mark itself, not a recolour of a
        // logo. Foreground = brand colour, background = a faint wash of it.
        color: brand.color,
        backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${brand.color} 35%, transparent)`,
      }}
      aria-hidden
      title={brand.label}
    >
      {brand.label.charAt(0)}
    </span>
  );
}

/**
 * ManufacturerWordmark — the official committed wordmark logo (original art, no
 * tint) for a manufacturer group header, or the brand name in its colour when no
 * wordmark asset exists. Sits on a neutral pill so a dark wordmark (Bitmain) is
 * legible on the dark surface.
 */
export function ManufacturerWordmark({
  manufacturer,
  count,
}: {
  manufacturer: Manufacturer;
  count: number;
}) {
  const brand = manufacturerBrand(manufacturer);
  return (
    <span className="inline-flex items-center gap-2.5">
      <ManufacturerMark manufacturer={manufacturer} size={22} />
      {brand.wordmark ? (
        // Real wordmark on a light pill so black/transparent artwork stays legible.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.wordmark}
          alt={brand.label}
          className="h-4 w-auto rounded-[3px] bg-[var(--ct-text-strong)] px-1.5 py-0.5"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className="text-[length:var(--ct-text-sm)] font-semibold"
          style={{ color: brand.color }}
        >
          {brand.label}
        </span>
      )}
      <span className="ct-metric-caption tabular-nums text-[var(--ct-text-muted)]">
        {count}
      </span>
    </span>
  );
}
