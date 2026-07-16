// src/lib/gpu1-client/btc.ts
//
// BTC domain (M-later). Scaffolded ahead of its GPU1 endpoint. The BTC view DTO
// is not yet defined in gpu1-backend/src/domain, so `BtcDTO` is a minimal LOCAL
// placeholder — when the canonical DTO lands in the domain contract, delete this
// interface and import it from ./schemas instead. Reuses domain primitives
// (Resolved, MiningMetrics) so the honesty envelope is already correct.

import { gpu1Fetch } from "./client";
import type { MiningMetrics, Resolved } from "./schemas";

/**
 * LOCAL placeholder for the BTC view DTO until it is promoted into the canonical
 * domain contract. Every field stays a browser-renderable string wrapped in the
 * Resolved<T> honesty envelope.
 */
export interface BtcDTO {
  /** Spot BTC/USD used across the product. */
  readonly spotUsd: Resolved<string>;
  /** BTC held / earned by the fleet, in sats — mirrors MiningMetrics.totalBtcEarnedSats. */
  readonly earnedSats: Resolved<string>;
  /** Mining production context behind the BTC number. */
  readonly mining: Resolved<MiningMetrics>;
}

/** GET /api/v1/btc — BTC view for the product. */
export function getBtc(): Promise<BtcDTO> {
  return gpu1Fetch<BtcDTO>("/api/v1/btc");
}
