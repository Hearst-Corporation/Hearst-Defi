/**
 * Asset brand palette + logos for the /portfolio/preview sandbox.
 *
 * Per product-owner direction the three vault assets carry their OWN brand identity:
 *   • Hearst / mining power → Hearst green (the app accent, #A7FB90)
 *   • Bitcoin (wBTC / cbBTC) → Bitcoin brand orange (#F7931A)
 *   • USDC / stablecoin      → USDC brand blue (#2775CA)
 *
 * These are LOCAL sandbox constants — they do NOT touch the design system / --ct-* tokens
 * (Hearst green is still read from the token). Orange/blue are official asset brand colours,
 * used only for asset identity here; the platform's "no red" rule still holds (orange ≠ red).
 * Logos are served from /public (Next static). Hearst has only a wordmark (used in the hero),
 * so its pocket badge falls back to a green compute glyph rather than a fake round icon.
 */
export type AssetKind = "hearst" | "bitcoin" | "usdc";

/** Asset identity colour. Hearst = token accent; Bitcoin/USDC = official brand hues. */
export const ASSET_COLOR: Record<AssetKind, string> = {
  hearst: "var(--ct-accent)",
  bitcoin: "#F7931A",
  usdc: "#2775CA",
};

/** Round asset logo (colored badge SVG in /public). Hearst = null → glyph badge instead. */
export const ASSET_LOGO: Record<AssetKind, { src: string; alt: string } | null> = {
  hearst: null,
  bitcoin: { src: "/crypto-icons/btc.svg", alt: "Bitcoin" },
  usdc: { src: "/crypto-icons/usdc.svg", alt: "USDC" },
};

/** Hearst wordmark (white + green) for the console hero letterhead. */
export const HEARST_WORDMARK = { src: "/logos/hearst-connect-dark.svg", alt: "Hearst Connect" };

/** Pocket index → asset (B1 mining power, B2 wBTC, B3 USDC). */
export const POCKET_ASSET: readonly AssetKind[] = ["hearst", "bitcoin", "usdc"];
