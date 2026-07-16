// src/lib/gpu1-client/mining.ts
//
// Mining domain (M-later). Scaffolded ahead of its GPU1 endpoint. The mining view
// DTO is not yet in gpu1-backend/src/domain, so `MiningDTO` is a minimal LOCAL
// placeholder built from the canonical MiningMetrics / MiningEngineStatus /
// ElectricityStatus / VaultSnapshot primitives — replace with the domain DTO once
// it exists. No fabricated numbers: every value comes wrapped in Resolved<T>.

import { gpu1Fetch } from "./client";
import type {
  ElectricityStatus,
  MiningEngineStatus,
  MiningMetrics,
  Resolved,
  VaultSnapshot,
} from "./schemas";

/**
 * LOCAL placeholder for the mining view DTO until it is promoted into the
 * canonical domain contract. Assembles the mining-relevant domain slices behind
 * their honesty envelopes so the UI renders status/provenance faithfully.
 */
export interface MiningDTO {
  readonly metrics: Resolved<MiningMetrics>;
  readonly engine: Resolved<MiningEngineStatus>;
  readonly electricity: Resolved<ElectricityStatus>;
  /** Vault context (miningNoteMode, product duration) the mining view reads. */
  readonly vault: Resolved<VaultSnapshot>;
}

/** GET /api/v1/mining — mining operations view. */
export function getMining(): Promise<MiningDTO> {
  return gpu1Fetch<MiningDTO>("/api/v1/mining");
}
