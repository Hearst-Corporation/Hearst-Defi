/**
 * Lab Colors — canonical sleeve color palette for the Strategy Hub.
 *
 * Green rule: mining sleeve ALWAYS uses `var(--ct-accent)` — never a literal
 * hex. This keeps the brand green in sync with the single DS token.
 *
 * DOCUMENTED EXCEPTION (the only hex literals allowed here):
 *   btc: "#F7931A" — Bitcoin brand orange (no --ct token exists)
 *   stableReserve: "#60A5FA" — sky blue (no --ct token exists)
 *   yieldOverlay: "#A78BFA" — soft violet (no --ct token exists)
 * These three are defined ONCE here. Never re-declare them in components.
 * They must not proliferate outside this file.
 *
 * Import from here — never re-declare these colors in individual components.
 */

// ---------------------------------------------------------------------------
// Sleeve palette
// ---------------------------------------------------------------------------

export const SLEEVE_COLORS = {
  /** Accent green — DS token var(--ct-accent). Never a hex literal. */
  mining: "var(--ct-accent)",
  /** Bitcoin brand orange. Documented single-source exception (no --ct token). */
  btc: "#F7931A",
  /** Stable reserve — sky blue. Documented single-source exception (no --ct token). */
  stableReserve: "#60A5FA",
  /** Yield overlay — soft violet. Documented single-source exception (no --ct token). */
  yieldOverlay: "#A78BFA",
} as const;

export type SleeveKey = keyof typeof SLEEVE_COLORS;

export const SLEEVE_LABEL: Record<SleeveKey, string> = {
  mining: "Mining",
  btc: "BTC",
  stableReserve: "Stable Reserve",
  yieldOverlay: "Yield",
};

/**
 * Canonical render order for sleeve columns, legends, and pie charts.
 * Mining is listed first (highest structural weight in the flagship strategy).
 */
export const sleeveOrder: readonly SleeveKey[] = [
  "mining",
  "btc",
  "stableReserve",
  "yieldOverlay",
] as const;

// ---------------------------------------------------------------------------
// Scenario accent dots — intentionally distinct from the sleeve palette so
// that scenario indicators never collide visually with sleeve breakdowns when
// both appear on the same surface.
// ---------------------------------------------------------------------------

export const SCENARIO_DOT: Record<"safe" | "balanced" | "opportunistic", string> = {
  /** Sky blue — documented single-source exception (no --ct token). */
  safe: "#60A5FA",
  /** Accent green — DS token var(--ct-accent). Never a hex literal. */
  balanced: "var(--ct-accent)",
  /** Bitcoin brand orange — documented single-source exception (no --ct token). */
  opportunistic: "#F7931A",
};
