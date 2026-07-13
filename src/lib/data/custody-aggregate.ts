// Pure custody aggregation — no I/O, no SDK, no server-only. The loader
// (data/custody.ts) maps the Fireblocks SDK response into RawCustodyAccount[]
// and calls this, so the math is unit-testable without any network.

export type CustodyProvenance = "live" | "manual";

export interface RawCustodyAccount {
  id: string;
  name: string;
  assets: { id: string; total: number }[];
}

export interface CustodyAssetBalance {
  assetId: string;
  total: number;
}

export interface CustodyAccountBalance {
  id: string;
  name: string;
  assets: CustodyAssetBalance[];
  /** USDC-family total for this account. */
  usdcTotal: number;
  /** BTC-family total for this account. */
  btcTotal: number;
}

export interface CustodyAggregate {
  accounts: CustodyAccountBalance[];
  totalUsdcReserves: number;
  totalBtcReserves: number;
}

/** Any Fireblocks asset id in the USDC family (USDC, USDC_ARB_3SBJ, …). */
export function isUsdcAsset(assetId: string): boolean {
  return assetId.toUpperCase().includes("USDC");
}

/** Any Fireblocks asset id in the BTC family (BTC, WBTC, cbBTC, tBTC, …). */
export function isBtcAsset(assetId: string): boolean {
  return assetId.toUpperCase().includes("BTC");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregates custody balances. When `accountIds` is non-empty, only those vault
 * accounts count toward reserves (the rest of the workspace is ignored); empty
 * means "all accounts" — useful for inspection but NOT a pinned PoR scope.
 */
export function aggregateCustody(
  raw: RawCustodyAccount[],
  opts: { accountIds?: string[] } = {},
): CustodyAggregate {
  const filter =
    opts.accountIds && opts.accountIds.length > 0
      ? new Set(opts.accountIds)
      : null;
  const selected = filter ? raw.filter((a) => filter.has(a.id)) : raw;

  let totalUsdcReserves = 0;
  let totalBtcReserves = 0;
  const accounts: CustodyAccountBalance[] = selected.map((a) => {
    let usdcTotal = 0;
    let btcTotal = 0;
    const assets: CustodyAssetBalance[] = a.assets.map((x) => {
      if (isUsdcAsset(x.id)) usdcTotal += x.total;
      if (isBtcAsset(x.id)) btcTotal += x.total;
      return { assetId: x.id, total: x.total };
    });
    usdcTotal = round2(usdcTotal);
    btcTotal = round2(btcTotal);
    totalUsdcReserves += usdcTotal;
    totalBtcReserves += btcTotal;
    return { id: a.id, name: a.name, assets, usdcTotal, btcTotal };
  });

  return {
    accounts,
    totalUsdcReserves: round2(totalUsdcReserves),
    totalBtcReserves: round2(totalBtcReserves),
  };
}
