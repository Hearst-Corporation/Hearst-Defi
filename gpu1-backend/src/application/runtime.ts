// gpu1-backend/src/application/runtime.ts — honest runtime status, no secrets.
import { loadEnv } from "../config/env.js";
import type { ContractRuntimeStatus } from "../domain/index.js";
import { lastSuccessfulDbCheck, pingDb } from "../persistence/prisma.js";

const startedAt = Date.now();

export function contractRuntime(): ContractRuntimeStatus {
  const env = loadEnv();
  // v2 contract not deployed yet → not_configured. When DYNAVAULT_ADDRESS is set,
  // the indexer (not the frontend) will confirm code presence; until then codePresent=false.
  if (!env.DYNAVAULT_ADDRESS) {
    return { mode: "not_configured", chainId: null, contractAddress: null, codePresent: false, indexerLagBlocks: null };
  }
  const mode = env.CHAIN_ID === 84532 ? "v2-testnet" : "v2-mainnet";
  return {
    mode,
    chainId: env.CHAIN_ID ?? null,
    contractAddress: env.DYNAVAULT_ADDRESS,
    codePresent: false, // set true by the indexer once it confirms bytecode
    indexerLagBlocks: null,
  };
}

export interface RuntimeReport {
  readonly serviceVersion: string;
  readonly commitSha: string | null;
  readonly environment: string;
  readonly uptimeSeconds: number;
  readonly db: { readonly reachable: boolean; readonly latencyMs: number | null };
  readonly databaseStatus: "ready" | "unreachable";
  readonly lastSuccessfulDbCheck: string | null;
  readonly providerMode: "gpu1-supabase";
  readonly contract: ContractRuntimeStatus;
  readonly contractStatus: "NOT_CONFIGURED" | "CONFIGURED";
  readonly indexer: { readonly status: "NOT_CONFIGURED" | "RUNNING" | "STALLED"; readonly lastSyncedAt: string | null };
  readonly indexerStatus: "NOT_CONFIGURED" | "RUNNING" | "STALLED";
}

export async function runtimeReport(nowMs: number): Promise<RuntimeReport> {
  const env = loadEnv();
  const latencyMs = await pingDb();
  const contract = contractRuntime();
  return {
    serviceVersion: process.env.GPU1_BACKEND_VERSION ?? "0.1.0",
    commitSha: process.env.GPU1_BACKEND_COMMIT_SHA ?? null,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round((nowMs - startedAt) / 1000),
    db: { reachable: latencyMs !== null, latencyMs },
    databaseStatus: latencyMs !== null ? "ready" : "unreachable",
    lastSuccessfulDbCheck: lastSuccessfulDbCheck(),
    providerMode: "gpu1-supabase",
    contract,
    contractStatus: contract.mode === "not_configured" ? "NOT_CONFIGURED" : "CONFIGURED",
    // Indexer not wired until the contract is deployed.
    indexer: { status: "NOT_CONFIGURED", lastSyncedAt: null },
    indexerStatus: "NOT_CONFIGURED",
  };
}
