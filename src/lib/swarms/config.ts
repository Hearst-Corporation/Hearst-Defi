import "server-only";

import { env } from "@/lib/env";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

/**
 * MySwarms / crewai-engine connection config.
 *
 * The external CrewAI engine (FastAPI, Python) is driven over HTTP with a
 * kickoff→poll model and a shared Bearer token. This module is the single place
 * that resolves the connection from env — every value is defensive (no throw at
 * import), mirroring the proven client pattern: a missing URL falls back to the
 * local dev engine, a missing token surfaces a clear EngineError at use-site
 * (never a global boot outage — see env.ts, the prod guard only WARNS).
 *
 * Activation is gated by SWARMS_ENGINE (default OFF). When off, nothing here is
 * reached at runtime and the in-repo agents keep running unchanged.
 */

/** Whether the external engine integration is switched on. */
export const SWARMS_ENABLED: boolean = FEATURE_FLAGS.SWARMS_ENGINE;

/** Engine base URL. Defaults to the local dev engine when unset. */
export const ENGINE_URL: string =
  env.CREWAI_ENGINE_URL ?? "http://localhost:8000";

/** Shared Bearer token. Empty when unprovisioned → 401 at use-site, not boot. */
export const ENGINE_TOKEN: string = env.CREWAI_ENGINE_AUTH_TOKEN ?? "";

/** Per-request timeout (ms) for a single HTTP call to the engine. */
export const ENGINE_TIMEOUT_MS: number = env.CREWAI_ENGINE_TIMEOUT_MS;

/**
 * Seeded, run-only global swarm templates living in the engine's DB. Invoked by
 * UUID (there is no slug routing on the engine). Extend as new templates land.
 */
export const SWARM_TEMPLATES = {
  /** HEDGE — Crypto Trade Analysis. Advisory only (CVaR/Kelly), zero order
   *  execution. 3 agents: Market Context Collector → Risk Analyst → Decision
   *  Writer. Inputs: asset, direction, timeframe, capital_eur, entry_price,
   *  risk_tolerance, thesis, notes. */
  HEDGE_CRYPTO_ANALYSIS: "dddddddd-0001-0001-0001-000000000001",
} as const;

export type SwarmTemplateId =
  (typeof SWARM_TEMPLATES)[keyof typeof SWARM_TEMPLATES];
