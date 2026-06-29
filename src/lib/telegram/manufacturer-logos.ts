/**
 * Manufacturer brand assets — maps a `Manufacturer` (from manufacturer-catalog)
 * to its real square brand ICON, committed under `public/manufacturers/`.
 *
 * The icons are the makers' real brand logos (Bitmain ant, Whatsminer horse,
 * Canaan hexagon, Bitdeer beaver, Bitaxe "B"), downloaded once and committed —
 * no hot-linking, original artwork, NO tint. Square so they sit inline before
 * the model name in the machines table.
 *
 * `other` has no icon (a neutral dot stands in). Pure data — no React, no I/O.
 */

import type { Manufacturer } from "./manufacturer-catalog";

export interface ManufacturerBrand {
  /** Display label. */
  label: string;
  /** Committed square icon asset, when we have an official one. */
  icon?: string;
}

export const MANUFACTURER_BRAND: Record<Manufacturer, ManufacturerBrand> = {
  bitmain: { label: "Bitmain", icon: "/manufacturers/bitmain.png" },
  microbt: { label: "MicroBT", icon: "/manufacturers/microbt.png" },
  bitdeer: { label: "Bitdeer", icon: "/manufacturers/bitdeer.png" },
  canaan: { label: "Canaan", icon: "/manufacturers/canaan.png" },
  bitaxe: { label: "Bitaxe", icon: "/manufacturers/bitaxe.png" },
  other: { label: "Autre" },
};

export function manufacturerBrand(m: Manufacturer): ManufacturerBrand {
  return MANUFACTURER_BRAND[m];
}
