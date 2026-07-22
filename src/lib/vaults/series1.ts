/**
 * Series 1 investor identity — the SINGLE place the investor cockpit resolves
 * "what is this product called and what does it promise".
 *
 * Why this module exists
 * ----------------------
 * The legacy investor surfaces read their naming straight off the Prisma
 * `VaultDeployment` row: `row.name` ("Hearst Yield Vault"), `row.strategy`
 * ("mining_yield" → "Mining Yield") and `row.targetApyLowBps/HighBps`
 * ("Est. yield range 8.0–15.0%"). Those columns still carry the retired
 * yield-vault framing, so every page that rendered them leaked v1 wording into
 * a v3.0 mining-note product.
 *
 * We do NOT mutate the database here — the columns stay as they are for admin,
 * accounting and historical memos. Instead the investor read boundary resolves
 * the product identity through this module, so a stale DB name can never reach
 * an investor surface again.
 *
 * Product doctrine (methodology v3.0, ADR-019): the note ACCUMULATES BTC over a
 * 24-month term and DELIVERS it at maturity. There is no periodic cash
 * distribution and no fixed APY, so no investor surface may render a yield
 * range, an APY, a coupon or a monthly distribution.
 */

import type { VaultProduct } from "@/lib/data/vaults";

/** Canonical investor-facing product name. Never `row.name`. */
export const SERIES1_NAME = "Hearst Bitcoin Reserve Vault";

/** Series designation, rendered next to the name. */
export const SERIES1_SERIES = "Series 1";

/** Full title used in page headings and `<title>`. */
export const SERIES1_FULL_NAME = `${SERIES1_NAME} — ${SERIES1_SERIES}`;

/** One-line product description for investor headers. */
export const SERIES1_DESCRIPTION =
  "A permissioned Bitcoin reserve built from real mining production, accumulated over a 24-month term and delivered in BTC at maturity.";

/**
 * What the note does NOT do. Rendered verbatim where an investor would
 * otherwise look for a rate — replaces the retired "Est. yield range" slot.
 */
export const SERIES1_NO_RATE_NOTE =
  "No fixed rate and no periodic cash distribution — return is the Bitcoin accumulated over the term, delivered at maturity, and is not guaranteed.";

/** Standing disclaimer appended wherever a projection is shown. */
export const SERIES1_DISCLAIMER =
  "Accumulated Bitcoin is delivered at maturity. Projections rest on stated assumptions and are not guaranteed.";

/** The three on-chain pockets, in investor language (B1 / B2 / B3). */
export const SERIES1_POCKETS = {
  B1: { code: "B1", label: "Mining Power", role: "Hashrate that produces the reserve" },
  B2: { code: "B2", label: "BTC Reserve", role: "Bitcoin held toward delivery" },
  B3: { code: "B3", label: "Operating Reserve", role: "USDC runway covering electricity and operations" },
} as const;

export type Series1PocketCode = keyof typeof SERIES1_POCKETS;

/**
 * Investor-facing status label. Deliberately narrower than the admin
 * `VAULT_STATUS_LABEL`: an investor reads whether the vault takes capital, not
 * the internal lifecycle state.
 */
export function series1StatusLabel(status: VaultProduct["status"]): string {
  switch (status) {
    case "live":
      return "Open · Active · Permissioned";
    case "review":
      return "In review — not open for subscription";
    case "paused":
      return "Subscriptions paused";
    case "closed":
      return "Closed to new capital";
    case "draft":
    default:
      return "Not yet open for subscription";
  }
}

/** True when the vault can currently accept a subscription. */
export function series1IsOpen(status: VaultProduct["status"]): boolean {
  return status === "live";
}

/**
 * Target pocket split (basis points) derived from the vault's own columns.
 * B3 folds the stable-reserve and USDC-base legs into one operating reserve —
 * the investor reads three pockets, matching the on-chain 40/27/33 structure.
 *
 * `actualBps` is deliberately absent: the realised on-chain split is not yet
 * indexed per vault, so investor surfaces show the TARGET, labelled as such,
 * and never a fabricated actual.
 */
export function series1TargetPockets(
  vault: VaultProduct,
): ReadonlyArray<{ code: Series1PocketCode; label: string; role: string; targetBps: number }> {
  return [
    { ...SERIES1_POCKETS.B1, code: "B1", targetBps: vault.targetMiningBps },
    { ...SERIES1_POCKETS.B2, code: "B2", targetBps: vault.targetBtcTacticalBps },
    {
      ...SERIES1_POCKETS.B3,
      code: "B3",
      targetBps: vault.targetStableReserveBps + vault.targetUsdcBaseBps,
    },
  ];
}

/**
 * Retired v1 product names still present in `VaultDeployment.name` rows. Any
 * stored name matching one of these is a legacy yield-vault label and must
 * never reach an investor surface.
 */
const RETIRED_NAME_PATTERN = /yield\s*vault|mining\s*yield/i;

/**
 * Resolve the investor-facing name for a position or vault row.
 *
 * A stored name is only trusted when it is NOT one of the retired yield-vault
 * labels; anything matching `RETIRED_NAME_PATTERN` (and any missing name)
 * falls back to the Series 1 designation. This is the read boundary that keeps
 * "Hearst Yield Vault" out of the cockpit without touching the database.
 */
export function series1DisplayName(storedName: string | null | undefined): string {
  const name = storedName?.trim();
  if (!name || RETIRED_NAME_PATTERN.test(name)) return SERIES1_SERIES;
  return name;
}

/**
 * Retired v1 disclaimer phrasing still stored in `VaultDeployment.disclaimers`.
 * The stored text describes the withdrawn yield product ("monthly USDC
 * distributions", "yield source", an APY range), which contradicts the Series 1
 * mining note and is forbidden on investor surfaces.
 */
const RETIRED_DISCLAIMER_PATTERN =
  /monthly\s+usdc\s+distribution|yield\s+source|yield\s+vault|\bapy\b|monthly\s+distribution|coupon/i;

/**
 * Return the stored vault disclaimer ONLY when it is free of retired v1
 * framing; otherwise return null so the caller falls back to the Series 1
 * disclaimer. Prevents a stale DB row from publishing a distribution promise
 * the product does not make.
 */
export function series1SafeDisclaimer(stored: string | null | undefined): string | null {
  const text = stored?.trim();
  if (!text || RETIRED_DISCLAIMER_PATTERN.test(text)) return null;
  return text;
}

/** Basis points → "40%" (no decimals for whole percentages). */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}
