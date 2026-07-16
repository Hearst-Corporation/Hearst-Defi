// src/lib/gpu1-client — the ONLY business data source for the Connect frontend.
//
// Every business read/write goes through GPU1 over HTTP. This barrel is the public
// surface: import from "@/lib/gpu1-client", never from the internal files. The
// client imports zero viem / prisma / chain code — it is pure transport, usable
// from Server Components, Server Actions, Route Handlers, and Client Components.
//
// There is NO fixture/RPC/legacy fallback anywhere below: a GPU1 failure surfaces
// as a GPU1Error and the caller renders an honest error/unavailable state.

// Transport primitive + config
export { gpu1Fetch, gpu1BaseUrl, type GPU1FetchOptions } from "./client";

// Error type
export { GPU1Error, isGPU1Error, type GPU1ErrorCode, type GPU1ErrorInit } from "./errors";

// Canonical domain types (re-exported from gpu1-backend/src/domain)
export type {
  SourceProvenance,
  DataStatus,
  DataFreshness,
  Resolved,
  VaultCapacity,
  VaultSnapshot,
  PocketId,
  VaultStrategy,
  VaultUserPosition,
  MiningMetrics,
  ElectricityStatus,
  MiningEngineStatus,
  VaultEventName,
  VaultEvent,
  ContractRuntimeMode,
  ContractRuntimeStatus,
  DashboardDTO,
} from "./schemas";

// Per-domain data functions
export { getDashboard } from "./dashboard";
export { getBtc, type BtcDTO } from "./btc";
export { getMining, type MiningDTO } from "./mining";
export { getProfile, type ProfileDTO } from "./profile";
export { getSubscription, type SubscriptionDTO } from "./subscription";
export { getAdmin, type AdminDTO } from "./admin";
