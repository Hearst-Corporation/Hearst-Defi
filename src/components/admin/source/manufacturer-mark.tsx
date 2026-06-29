import { cn } from "@/lib/cn";
import type { Manufacturer } from "@/lib/telegram/manufacturer-catalog";
import { manufacturerBrand } from "@/lib/telegram/manufacturer-logos";

/**
 * ManufacturerLogo — the maker's real square brand icon (original artwork, NO
 * tint), shown inline before the model name. The icon sits on a light chip so
 * dark/transparent artwork (e.g. the black Bitmain ant) stays visible on the
 * dark cockpit surface — the logo itself is never recoloured, only the chip
 * behind it. Falls back to a neutral dot when the maker has no committed icon.
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
          "inline-flex shrink-0 items-center justify-center rounded-[5px] bg-[var(--ct-surface-inset)]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span
          className="rounded-full bg-[var(--ct-text-muted)]"
          style={{
            width: Math.round(size * 0.34),
            height: Math.round(size * 0.34),
          }}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white",
        className,
      )}
      style={{ width: size, height: size, padding: Math.round(size * 0.12) }}
      title={brand.label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.icon}
        alt={brand.label}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
