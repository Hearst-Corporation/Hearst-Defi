/**
 * Manufacturer brand assets — maps a `Manufacturer` (from manufacturer-catalog)
 * to its real wordmark logo (when we have an official one committed) and an
 * official brand colour used for the compact per-row mark.
 *
 * Wordmarks were downloaded once from the makers' official sites and committed
 * under `public/manufacturers/` (Bitmain ANTMINER wordmark, Bitdeer wordmark+
 * icon) — no hot-linking, original artwork, NO tint. They are horizontal
 * wordmarks, so they render on the GROUP header, not inline per row.
 *
 * The per-row mark is a compact initial pill in the maker's official brand
 * colour — a typographic brand mark (not a fake logo), legible on the dark
 * cockpit surface where a black wordmark (Bitmain) would vanish. Makers without
 * a committed wordmark (MicroBT, Canaan, Bitaxe) still get their brand colour +
 * initial, so every row reads consistently.
 *
 * Pure data — no React, no I/O.
 */

import type { Manufacturer } from "./manufacturer-catalog";

export interface ManufacturerBrand {
  /** Display label (matches MANUFACTURER_LABELS family). */
  label: string;
  /** Official brand colour (hex) for the compact initial mark. */
  color: string;
  /** Committed wordmark asset, when we have an official one. */
  wordmark?: string;
}

export const MANUFACTURER_BRAND: Record<Manufacturer, ManufacturerBrand> = {
  // Bitmain brand yellow; official ANTMINER wordmark (black artwork → header only).
  bitmain: {
    label: "Bitmain",
    color: "#F7B500",
    wordmark: "/manufacturers/bitmain.png",
  },
  // MicroBT / Whatsminer brand blue.
  microbt: { label: "MicroBT", color: "#1E6FFF" },
  // Bitdeer / Sealminer brand green; official wordmark committed.
  bitdeer: {
    label: "Bitdeer",
    color: "#19C37D",
    wordmark: "/manufacturers/bitdeer.png",
  },
  // Canaan / Avalon brand green.
  canaan: { label: "Canaan", color: "#00A86B" },
  // Bitaxe community orange.
  bitaxe: { label: "Bitaxe", color: "#F2792B" },
  // Unknown maker — neutral.
  other: { label: "Autre", color: "#8A8F98" },
};

export function manufacturerBrand(m: Manufacturer): ManufacturerBrand {
  return MANUFACTURER_BRAND[m];
}
