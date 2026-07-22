// src/lib/backend — the ONLY business data source for the Connect frontend.
//
// Every business read/write goes through hearst-connect-backend over HTTP.
// This barrel is the public surface: import from "@/lib/backend", never from
// the internal files directly. The client imports zero prisma / chain code —
// it is pure transport, usable from Server Components, Server Actions, Route
// Handlers, and (via browser-client.ts, once built) Client Components.
//
// There is NO fixture/Prisma/legacy fallback anywhere below: a backend
// failure surfaces as a BackendError and the caller renders an honest
// error/unavailable state.

export { backendFetch, type BackendFetchOptions } from "./client";
export { BackendError, isBackendError, type BackendErrorCode, type BackendErrorInit } from "./errors";

export type {
  Envelope,
  ResponseMeta,
  EnvelopeStatus,
  SourceProvenance,
  DataStatus,
  DataFreshness,
  Resolved,
  PocketId,
  VaultSnapshot,
  VaultStrategy,
  VaultCapacityBlock,
  VaultEvent,
  VaultEventName,
  AllocationPocket,
  MiningMetrics,
  ElectricityStatus,
  RebalancingSummary,
  DashboardDTO,
  BtcDTO,
  MiningDTO,
  ContractRuntimeStatus,
  ContractRuntimeMode,
  // DynaVault v2.1 additional reads
  VaultDTO,
  VaultStrategiesDTO,
  StrategyDetailDTO,
  RwaPocket,
  RwaVaultDTO,
  RebalancingStatusDTO,
  MiningOnchainDTO,
  MiningElectricityDTO,
  FactsheetTerms,
  FactsheetAllocation,
  VendingCurvePoint,
  ProductFactsheetDTO,
  BacktestRunSummary,
  BacktestHistoricalDTO,
} from "./contracts";

// Server-side loaders (session-authenticated calls to the backend)
export {
  getDashboardFromBackend,
  getBtcFromBackend,
  getMiningFromBackend,
  // DynaVault v2.1 additional reads
  getVaultFromBackend,
  getVaultStrategiesFromBackend,
  getStrategyFromBackend,
  getRwaVaultFromBackend,
  getRebalancingStatusFromBackend,
  getMiningOnchainFromBackend,
  getMiningElectricityFromBackend,
  getProductFactsheetFromBackend,
  getBacktestHistoricalFromBackend,
} from "./server-client";
