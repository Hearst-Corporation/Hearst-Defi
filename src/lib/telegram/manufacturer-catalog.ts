/**
 * manufacturer-catalog.ts — PURE machine classification by MANUFACTURER + known
 * specs (no I/O, fully testable).
 *
 * Two jobs:
 *   1. Classify each model label by manufacturer (Bitmain / MicroBT / Bitdeer /
 *      Canaan / Bitaxe / other) — for grouping the machine table by maker.
 *   2. Supply the official efficiency (J/TH) for models where Letine does NOT
 *      print it in the price line — notably Bitmain Antminer, which Letine lists
 *      with price-per-T but no wattage. Verified against vendor spec pages 2026.
 *
 * Energy can't be computed without J/TH, so this catalog is what makes the
 * Antminer fleet (Adrien's primary hardware) price-able end-to-end.
 */

export type Manufacturer =
  | "bitmain"
  | "microbt"
  | "bitdeer"
  | "canaan"
  | "bitaxe"
  | "other";

/** Classify a model label by manufacturer. Order: most specific brand tokens. */
export function manufacturerOf(model: string): Manufacturer {
  const l = model.toLowerCase();
  if (/\bs1\d|\bs2\d|antminer|\bt21\b|\bl7\b|\bl9\b|\bl11\b|\bz15\b|\bdg\b/.test(l)) {
    // Bitmain SHA/Scrypt/Zcash families (S/T/L/Z/DG series).
    return "bitmain";
  }
  if (/\bm[567]\d|whatsminer/.test(l)) return "microbt";
  if (/sealminer|\ba2\b|\ba3\b|\ba15\b/.test(l)) return "bitdeer";
  if (/avalon|canaan|nano3|mini3|\bavalon q\b/.test(l)) return "canaan";
  if (/bitaxe|gamma|nerd|qaxe|octaxe|supra|gt801|fluminer/.test(l)) return "bitaxe";
  return "other";
}

/**
 * Known efficiency (J/TH) by model pattern — used ONLY when the parsed line
 * carried no efficiency. Verified against Bitmain/MicroBT spec pages (2026).
 * First match wins; order specific → generic.
 */
interface EffRule {
  match: RegExp;
  jTh: number;
  note: string;
}

export const EFFICIENCY_RULES: readonly EffRule[] = [
  // ── Bitmain Antminer (Letine omits wattage for these) ──────────────
  { match: /s21\s*xp\s*hyd/i, jTh: 12, note: "Antminer S21 XP Hyd — 12 J/TH" },
  { match: /s21\s*xp/i, jTh: 13.5, note: "Antminer S21 XP — 13.5 J/TH" },
  { match: /s21\s*pro/i, jTh: 15, note: "Antminer S21 Pro — 15 J/TH" },
  { match: /s21e?\+\s*hyd|s21\+\s*hyd/i, jTh: 16, note: "Antminer S21+ Hyd — ~16 J/TH" },
  { match: /s21\+\+/i, jTh: 16.5, note: "Antminer S21++ — ~16.5 J/TH" },
  { match: /s21\+/i, jTh: 16, note: "Antminer S21+ — ~16 J/TH" },
  { match: /s21\s*imm/i, jTh: 16, note: "Antminer S21 IMM — ~16 J/TH" },
  { match: /\bs21\b/i, jTh: 17.5, note: "Antminer S21 — 17.5 J/TH" },
  { match: /s19\s*xp\+?\s*hyd/i, jTh: 20, note: "Antminer S19 XP Hyd — ~20 J/TH" },
  { match: /s19\s*xp/i, jTh: 21.5, note: "Antminer S19 XP — 21.5 J/TH" },
];

/**
 * Resolve efficiency: prefer the value parsed from the line; otherwise fall back
 * to the catalog rules. Returns null when neither is known.
 */
export function resolveEfficiency(
  model: string,
  parsedJTh: number | null,
): { jTh: number | null; source: "line" | "catalog" | "unknown"; note: string } {
  if (parsedJTh && parsedJTh > 0) {
    return { jTh: parsedJTh, source: "line", note: "From message line" };
  }
  for (const rule of EFFICIENCY_RULES) {
    if (rule.match.test(model)) {
      return { jTh: rule.jTh, source: "catalog", note: rule.note };
    }
  }
  return { jTh: null, source: "unknown", note: "No efficiency known" };
}
