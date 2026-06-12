/**
 * Hex palette for @react-pdf/renderer surfaces (no CSS vars at runtime).
 * Web UI colours live in cockpit.css / tokens.css — PDF print uses separate
 * ink-on-white values where noted (status colours).
 */

export const CONNECT_ACCENT_HEX = "#A7FB90" as const;

/** Dark statement PDF — flattened colours for react-pdf on deep background. */
export const PDF_DARK = {
  accent: CONNECT_ACCENT_HEX,
  bgDeep: "#0A0A0A",
  surface: "#141414",
  textPrimary: "#F5F5F5",
  textMuted: "#8A8A8A",
  textFaint: "#4A4A4A",
  border: "#222222",
} as const;

/** Light investor memo — printable on white paper. */
export const PDF_LIGHT = {
  bg: "#ffffff",
  bgMuted: "#f7f7f7",
  bgRow: "#fafafa",
  textPrimary: "#0a0a0a",
  textMuted: "#5a5a5a",
  textDim: "#999999",
  brand: CONNECT_ACCENT_HEX,
  brandStrong: "#0a0a0a",
  border: "#e5e5e5",
  borderStrong: "#cfcfcf",
  // Print ink — intentionally denser than web --ct-status-* (glow on dark UI).
  statusSuccess: "#16a34a",
  statusSuccessSoft: "#dcfce7",
  statusSuccessBrandTint: "#e9fde0",
  statusWarning: "#d97706",
  statusWarningSoft: "#fef3c7",
  statusDanger: "#dc2626",
  statusDangerSoft: "#fee2e2",
} as const;

/** Allocation strokes for light PDF charts (web: allocation-colors.ts). */
export const PDF_ALLOCATION = {
  mining: PDF_LIGHT.textPrimary,
  usdc_base: PDF_LIGHT.textMuted,
  btc_tactical: CONNECT_ACCENT_HEX,
  stable_reserve: PDF_LIGHT.borderStrong,
} as const;
