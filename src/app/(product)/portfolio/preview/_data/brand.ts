/**
 * Asset brand palette + logos for the /portfolio/preview sandbox.
 *
 * Per product-owner direction the three vault assets carry their OWN brand identity,
 * every one sourced from a design-system category token (no hard-coded hex):
 *   • Hearst / mining power → --ct-cat-mining (the app accent, green)
 *   • Bitcoin (wBTC / cbBTC) → --ct-cat-btc   (BTC-correlated exposure, amber)
 *   • USDC / stablecoin      → --ct-cat-usdc  (stablecoin yield, blue)
 *
 * These read the SAME --ct-cat-* tokens the rest of the cockpit uses for asset
 * identity, so there is a single source of truth and no stray hex in the markup.
 * The platform's "no red" rule still holds (amber ≠ red). Logos are served from
 * /public (Next static). Hearst has only a wordmark (used in the hero), so its
 * pocket badge falls back to a green compute glyph rather than a fake round icon.
 */
export type AssetKind = "hearst" | "bitcoin" | "usdc";

/** Asset identity colour — all from --ct-cat-* category tokens (single source of truth). */
export const ASSET_COLOR: Record<AssetKind, string> = {
  hearst: "var(--ct-cat-mining)",
  bitcoin: "var(--ct-cat-btc)",
  usdc: "var(--ct-cat-usdc)",
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
