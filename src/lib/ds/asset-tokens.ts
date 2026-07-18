/**
 * Asset semantic tokens — CSS custom property references only.
 * Literal colour values live in cockpit.css (`--ct-asset-*`).
 * Import from here; never hard-code BTC/USDC/mining hex in components.
 */

export const ASSET_TOKEN = {
  btc: "var(--ct-asset-btc)",
  btcSoft: "var(--ct-asset-btc-soft)",
  btcBorder: "var(--ct-asset-btc-border)",
  usdc: "var(--ct-asset-usdc)",
  usdcSoft: "var(--ct-asset-usdc-soft)",
  usdcBorder: "var(--ct-asset-usdc-border)",
  mining: "var(--ct-asset-mining)",
  miningSoft: "var(--ct-asset-mining-soft)",
  miningBorder: "var(--ct-asset-mining-border)",
  reserve: "var(--ct-asset-reserve)",
  reserveSoft: "var(--ct-asset-reserve-soft)",
  live: "var(--ct-status-success)",
  neutral: "var(--ct-chart-neutral)",
  grid: "var(--ct-chart-grid)",
  axis: "var(--ct-chart-axis)",
} as const;
