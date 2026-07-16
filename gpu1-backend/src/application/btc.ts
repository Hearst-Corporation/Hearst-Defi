// gpu1-backend/src/application/btc.ts
//
// Composes the aggregated BtcDTO — the BTC-pouch / treasury lens of the vault.
//
// HONESTY. Every BTC fact this screen shows is OWNED BY THE v2 CONTRACT:
//   - `reserve`        : USDC/BTC reserve held by the vault (on-chain balance)
//   - `exposure`       : the vault's BTC exposure (B2 pouch value, on-chain)
//   - `btcProduced`    : BTC credited to the vault (indexed MiningMetricsReported)
//   - `takeProfitTiers`: on-chain take-profit ladder + TakeProfitExecuted events
//   - `events`         : indexed BTC-relevant vault events
// The contract is NOT deployed and NOTHING is indexed yet. There is no trustworthy
// off-chain source for any of these (a spot BTC price would be a market quote, not
// the vault's actual reserve/exposure — showing it would be a fabricated position).
// So EVERY field is honestly NOT_CONFIGURED with `value: null`. When v2 is deployed
// + indexed behind GPU1, each field flips to LIVE/indexed here — the client never
// changes. No fixtures, no fallbacks, no synthesised numbers.
import type {
  ContractRuntimeStatus,
  DataFreshness,
  Resolved,
  VaultEvent,
} from "../domain/index.js";
import { contractRuntime } from "./runtime.js";

const FRESH_NONE: DataFreshness = { asOf: null, ageSeconds: null, stale: false };

/** Everything the contract owns is unavailable until v2 is deployed + indexed. */
function notConfigured<T>(): Resolved<T> {
  return {
    status: "NOT_CONFIGURED",
    value: null,
    provenance: "live",
    freshness: FRESH_NONE,
    reason: "dynavault_not_deployed",
  };
}

/** The vault's BTC reserve (on-chain custodial balance), USDC-denominated string. */
export interface BtcReserve {
  readonly balanceUsdc: string | null;
  readonly balanceBtc: string | null;
}

/** The vault's BTC exposure via the B2 pouch (on-chain), USDC-denominated. */
export interface BtcExposure {
  readonly pouch: "B2";
  readonly valueUsdc: string | null;
  readonly targetBps: number | null;
  readonly actualBps: number | null;
}

/** BTC credited to the vault by the mining operation (indexed from chain). */
export interface BtcProduced {
  readonly totalSats: string | null;
  readonly lastReportTime: string | null;
}

/** One rung of the on-chain take-profit ladder. */
export interface TakeProfitTier {
  readonly triggerBtcUsd: string | null;
  readonly sellBps: number | null;
  readonly executed: boolean | null;
}

export interface BtcDTO {
  readonly runtime: ContractRuntimeStatus;
  readonly reserve: Resolved<BtcReserve>;
  readonly exposure: Resolved<BtcExposure>;
  readonly btcProduced: Resolved<BtcProduced>;
  readonly takeProfitTiers: Resolved<readonly TakeProfitTier[]>;
  readonly events: Resolved<readonly VaultEvent[]>;
}

// The BtcDTO has no DB-backed surface today (unlike the dashboard's user position):
// there is no persisted table that holds the vault's real BTC reserve/exposure —
// those are strictly on-chain. `deps` is accepted to match the builder signature and
// to keep the door open for a future indexed/DB source without a client change.
export interface BtcDeps {
  readonly nowMs: number;
}

export async function buildBtc(_userId: string, _deps: BtcDeps): Promise<BtcDTO> {
  const runtime = contractRuntime();

  // Contract-owned surfaces — honest NOT_CONFIGURED until v2 is live + indexed.
  // Nothing here is fabricated: no spot BTC price stands in for the vault's reserve.
  return {
    runtime,
    reserve: notConfigured(),
    exposure: notConfigured(),
    btcProduced: notConfigured(),
    takeProfitTiers: notConfigured(),
    events: notConfigured(),
  };
}
