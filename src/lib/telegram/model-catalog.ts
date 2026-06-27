/**
 * model-catalog.ts — PURE model → cooling catalog (no I/O, fully testable).
 *
 * Letine lists machines under brand headers (Whatsminer / Avalon / Bitaxe) with
 * NO air/hydro/immersion marker, so the parser leaves them `unknown`. This
 * catalog resolves cooling from the MODEL itself, using verified vendor specs.
 *
 * Cooling is determined in priority order:
 *   1. Explicit token in the label  (Hyd / IMM / Immersion / Air)   → strongest
 *   2. Model-family rule below       (verified per manufacturer spec)
 *   3. Brand default                 (last resort, never `unknown`)
 *
 * Sources (verified 2026-06): MicroBT/Whatsminer, Canaan/Avalon, Bitaxe/Nerd
 * product pages — see docs note. Naming conventions:
 *   - Whatsminer M5x / M6x      → air      (dual-fan)
 *   - Whatsminer M63 family     → hydro    (sealed water loop, 4U)
 *   - Whatsminer M70 / M70S     → air      (dual-fan, 13.5 J/TH)
 *   - Whatsminer M73 / M74      → hydro    (CDU liquid loop)
 *   - Whatsminer M7D / M7DS     → hydro    (water-cooled)
 *   - Avalon (all listed)       → air
 *   - Bitaxe / Nerd*            → air      (unless "Hydro" in name)
 */

import type { Cooling } from "./parse-machine-price";

export type ResolvedCooling = "air" | "hydro" | "immersion";

interface CatalogRule {
  /** Regex tested against the (normalized) model label. */
  match: RegExp;
  cooling: ResolvedCooling;
  /** Human note for the catalog UI. */
  note: string;
}

/**
 * Family rules, evaluated top-to-bottom; first match wins. Order matters —
 * more specific patterns (M63, M73, M7D) precede broader ones (M6x, M7x).
 */
export const CATALOG_RULES: readonly CatalogRule[] = [
  // ── Antminer (Bitmain) ──────────────────────────────────────────────
  { match: /\bS\d+.*\bimm\b/i, cooling: "immersion", note: "Antminer immersion (IMM)" },
  { match: /\bS\d+.*\bhyd\b/i, cooling: "hydro", note: "Antminer hydro (Hyd)" },
  { match: /\bS19|\bS21/i, cooling: "air", note: "Antminer S-series air (default)" },

  // ── Whatsminer (MicroBT) ────────────────────────────────────────────
  // Hydro families first (most specific).
  { match: /\bM63\b|\bM63S\b|M63S\+/i, cooling: "hydro", note: "Whatsminer M63 family — hydro" },
  { match: /\bM7D\b|\bM7DS\b/i, cooling: "hydro", note: "Whatsminer M7D/M7DS — hydro" },
  { match: /\bM73|\bM74/i, cooling: "hydro", note: "Whatsminer M73/M74 — hydro (CDU loop)" },
  // Air families.
  { match: /\bM70\b|\bM70S\b/i, cooling: "air", note: "Whatsminer M70/M70S — air (dual-fan)" },
  { match: /\bM5\d|\bM6\d/i, cooling: "air", note: "Whatsminer M5x/M6x — air" },

  // ── Sealminer (Bitdeer) ─────────────────────────────────────────────
  { match: /\bA\d.*\bhyd\b/i, cooling: "hydro", note: "Sealminer hydro (Hyd)" },
  { match: /\bA2\b|\bA3\b/i, cooling: "air", note: "Sealminer A-series air (default)" },

  // ── Avalon (Canaan) ─────────────────────────────────────────────────
  { match: /avalon/i, cooling: "air", note: "Avalon — air" },

  // ── Bitaxe / Nerd (open-source solo) ────────────────────────────────
  { match: /nerd.*hydro|hydro.*nerd/i, cooling: "hydro", note: "Nerd Hydro variant" },
  { match: /bitaxe|gamma|nerd|qaxe|octaxe|supra|gt801/i, cooling: "air", note: "Bitaxe/Nerd solo — air" },

  // ── ZEC / LTC / misc ────────────────────────────────────────────────
  { match: /\bhyd\b/i, cooling: "hydro", note: "Generic hydro marker" },
  { match: /\bimm\b|immersion/i, cooling: "immersion", note: "Generic immersion marker" },
];

/** Fallback when no rule matches — air is the safe, shortest-amortization default. */
export const CATALOG_FALLBACK: ResolvedCooling = "air";

export interface CatalogResolution {
  cooling: ResolvedCooling;
  /** "label" if a token in the name decided it, else "catalog" or "fallback". */
  source: "label" | "catalog" | "fallback";
  note: string;
}

/**
 * Resolve the cooling for a model label. `parsedCooling` is whatever the parser
 * already inferred from the section/label (air/hydro/immersion/unknown); a real
 * value there wins, since it came from the message's own structure.
 */
export function resolveCooling(
  model: string,
  parsedCooling: Cooling,
): CatalogResolution {
  if (parsedCooling !== "unknown") {
    return { cooling: parsedCooling, source: "label", note: "From message section/label" };
  }
  for (const rule of CATALOG_RULES) {
    if (rule.match.test(model)) {
      return { cooling: rule.cooling, source: "catalog", note: rule.note };
    }
  }
  return { cooling: CATALOG_FALLBACK, source: "fallback", note: "No rule matched — air default" };
}
