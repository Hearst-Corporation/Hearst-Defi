import { cn } from "@/lib/cn";
import type { Manufacturer } from "@/lib/telegram/manufacturer-catalog";
import { manufacturerBrand } from "@/lib/telegram/manufacturer-logos";

/**
 * ManufacturerLogo — the maker's real square brand icon (original artwork, NO
 * tint), shown inline before the model name. Falls back to a neutral dot when
 * the maker has no committed icon (Autre).
 */
export function ManufacturerLogo({
  manufacturer,
  size = 18,
  className,
}: {
  manufacturer: Manufacturer;
  size?: number;
  className?: string;
}) {
  const brand = manufacturerBrand(manufacturer);

  if (!brand.icon) {
    return (
      <span
        className={cn(
          "inline-block shrink-0 rounded-full bg-[var(--ct-text-muted)]",
          className,
        )}
        style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.icon}
      alt={brand.label}
      title={brand.label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-[4px] object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
