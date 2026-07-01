/**
 * Lab Colors — canonical sleeve color palette for the Strategy Hub.
 *
 * DOCUMENTED EXCEPTION: The four SLEEVE_COLORS hex values below are the ONE
 * acted exception to the token-only rule (documented in CLAUDE.md). They are
 * hardcoded because they represent external brand conventions (Bitcoin orange,
 * accent green already matched by --ct-accent, etc.) that must stay consistent
 * across charts, legends, and tables. Everything else in the codebase must use
 * --ct-* CSS tokens; these four hexes must not proliferate outside this file.
 *
 * Import from here — never re-declare these colors in individual components.
 */

// ---------------------------------------------------------------------------
// Sleeve palette
// ---------------------------------------------------------------------------

export const SLEEVE_COLORS = {
  /** Accent green — matches --ct-accent #A7FB90. */
  mining: "#A7FB90",
  /** Bitcoin brand orange. */
  btc: "#F7931A",
  /** Stable reserve — sky blue. */
  stableReserve: "#60A5FA",
  /** Yield overlay — soft violet. */
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
  safe: "#60A5FA",
  balanced: "#A7FB90",
  opportunistic: "#F7931A",
};
