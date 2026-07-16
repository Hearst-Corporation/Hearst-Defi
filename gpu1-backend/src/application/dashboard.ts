// gpu1-backend/src/application/dashboard.ts
//
// Composes the aggregated DashboardDTO. GPU1 owns this composition — the frontend
// makes ONE call and renders. Honesty rules: DB-backed facts (the user's position)
// are LIVE; contract-backed facts (vault totals, strategies, mining, engine) are
// NOT_CONFIGURED until the v2 contract is deployed + indexed. No fabricated values,
// no fixture fallback.
import type {
  DashboardDTO,
  DataFreshness,
  Resolved,
  VaultUserPosition,
} from "../domain/index.js";
import type { VaultRepository } from "../persistence/vault-repository.js";
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

export interface DashboardDeps {
  readonly repo: VaultRepository;
  readonly nowMs: number;
}

export async function buildDashboard(userId: string, deps: DashboardDeps): Promise<DashboardDTO> {
  const runtime = contractRuntime();

  // DB-backed: the user's on-book position is real and LIVE regardless of contract state.
  let position: Resolved<VaultUserPosition>;
  try {
    const p = await deps.repo.getUserPosition(userId);
    position =
      p === null
        ? { status: "PARTIAL", value: null, provenance: "db", freshness: FRESH_NONE, reason: "no_investor_record" }
        : { status: "LIVE", value: p, provenance: "db", freshness: FRESH_NOW(deps.nowMs) };
  } catch {
    position = { status: "UNAVAILABLE", value: null, provenance: "db", freshness: FRESH_NONE, reason: "db_error" };
  }

  return {
    runtime,
    // Contract-owned surfaces — honest NOT_CONFIGURED until v2 is live behind GPU1.
    vault: notConfigured(),
    capacity: notConfigured(),
    position,
    strategies: notConfigured(),
    mining: notConfigured(),
    engine: notConfigured(),
    recentEvents: notConfigured(),
  };
}
