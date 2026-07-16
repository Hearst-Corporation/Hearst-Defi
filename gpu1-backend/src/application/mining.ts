// gpu1-backend/src/application/mining.ts
//
// Composes the aggregated MiningDTO — the mining lens of the vault.
//
// HONESTY, two layers:
//   1. On-chain / attested mining facts owned by the v2 contract —
//      `hashrate` (reportedHashrate the operator attests on-chain),
//      `btcEarned` (sats credited to the vault), `electricity` (on-chain elec
//      payment engine), `curtailment` (CurtailmentTriggered/Lifted), `engine`
//      (MonthlyEngineRun state). The contract is NOT deployed and NOTHING is
//      indexed → ALL of these are honestly NOT_CONFIGURED (`value: null`).
//      Antpool was never integrated, so there is no off-chain pool source to
//      stand in either — we do NOT synthesise a hashrate/uptime/BTC-earned value.
//   2. Operational fleet/market telemetry that DOES live in the canonical DB
//      (`MiningMetric`). This is real DB data — exposed as LIVE when rows exist,
//      NOT_CONFIGURED when the table is empty. It is clearly separated from the
//      on-chain facts above and never used to fill them in.
import type {
  ContractRuntimeStatus,
  DataFreshness,
  ElectricityStatus,
  MiningEngineStatus,
  MiningMetrics,
  Resolved,
} from "../domain/index.js";
import type { MiningRepository, MiningTelemetryRow } from "../persistence/mining-repository.js";
import { contractRuntime } from "./runtime.js";

const FRESH_NOW = (nowMs: number): DataFreshness => ({
  asOf: new Date(nowMs).toISOString(),
  ageSeconds: 0,
  stale: false,
});

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

export interface MiningDTO {
  readonly runtime: ContractRuntimeStatus;
  // ── On-chain / attested surfaces (contract-owned → NOT_CONFIGURED today) ──
  readonly hashrate: Resolved<MiningMetrics>;
  readonly btcEarned: Resolved<MiningMetrics>;
  readonly electricity: Resolved<ElectricityStatus>;
  readonly curtailment: Resolved<MiningEngineStatus>;
  readonly engine: Resolved<MiningEngineStatus>;
  // ── Real DB telemetry (LIVE when rows exist, else NOT_CONFIGURED) ─────────
  readonly operationalTelemetry: Resolved<MiningTelemetryRow>;
}

export interface MiningDeps {
  readonly repo: MiningRepository;
  readonly nowMs: number;
}

export async function buildMining(_userId: string, deps: MiningDeps): Promise<MiningDTO> {
  const runtime = contractRuntime();

  // Real DB-backed telemetry: LIVE only if a row actually exists; never fabricated.
  let operationalTelemetry: Resolved<MiningTelemetryRow>;
  try {
    const row = await deps.repo.getLatestTelemetry();
    operationalTelemetry =
      row === null
        ? notConfigured()
        : { status: "LIVE", value: row, provenance: "db", freshness: FRESH_NOW(deps.nowMs) };
  } catch {
    operationalTelemetry = {
      status: "UNAVAILABLE",
      value: null,
      provenance: "db",
      freshness: FRESH_NONE,
      reason: "db_error",
    };
  }

  return {
    runtime,
    // Contract-owned surfaces — honest NOT_CONFIGURED until v2 is live + indexed.
    hashrate: notConfigured(),
    btcEarned: notConfigured(),
    electricity: notConfigured(),
    curtailment: notConfigured(),
    engine: notConfigured(),
    operationalTelemetry,
  };
}
