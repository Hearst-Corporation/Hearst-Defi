// gpu1-backend/src/domain — CANONICAL domain models.
//
// This is the shared contract between the API (DTOs it returns) and the frontend
// client (`src/lib/gpu1-client`). Transport-independent: no Prisma types, no ABI
// tuples, no bare BigInt cross this boundary — everything is a string/number the
// browser can render directly. Mirrors the v2.1 vault spec (docs/VAULT_SPEC_V2.1.md).

/** Every field carries where it came from and whether it can be trusted. */
export type SourceProvenance =
  | "live" // read fresh from a live source (chain/db/provider)
  | "db" // persisted in the canonical DB (may be a snapshot)
  | "indexed" // ingested from an on-chain event
  | "manual" // operator-entered product constant
  | "fixture"; // explicitly a fixture — NEVER shown as real

/** Business status of a value. The frontend renders these honestly; it must never
 *  turn UNAVAILABLE into 0 or NOT_CONFIGURED into a fixture. */
export type DataStatus =
  | "LIVE"
  | "STALE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED";

export interface DataFreshness {
  readonly asOf: string | null; // ISO timestamp of the underlying data
  readonly ageSeconds: number | null;
  readonly stale: boolean;
}

/** Wrapper for any resolved value + its honesty metadata. `value` is null unless
 *  status is LIVE/STALE/PARTIAL. */
export interface Resolved<T> {
  readonly status: DataStatus;
  readonly value: T | null;
  readonly provenance: SourceProvenance;
  readonly freshness: DataFreshness;
  readonly reason?: string; // machine reason when value is null
}

// ── Vault ────────────────────────────────────────────────────────────────────

export interface VaultCapacity {
  readonly totalCapacity: string | null; // tvlCap, USDC 6dp as decimal string
  readonly usedCapacity: string | null; // totalAssets
  readonly availableCapacity: string | null; // max(tvlCap - totalAssets, 0) — computed HERE, never in the client
  readonly utilizationBps: number | null;
  readonly subscriptionOpen: boolean;
  readonly whitelistRequired: boolean;
  readonly minimumDeposit: string | null;
}

export interface VaultSnapshot {
  readonly asset: string; // "USDC"
  readonly assetDecimals: 6;
  readonly totalAssets: string | null;
  readonly totalShares: string | null;
  readonly navPerShare: string | null;
  readonly permissionDisabled: boolean | null;
  readonly miningNoteMode: boolean | null;
  readonly productDurationMonths: number | null;
}

export type PocketId = "B1" | "B2" | "B3";

export interface VaultStrategy {
  readonly pocket: PocketId;
  readonly label: string; // "Mining Power" | "BTC Pouch" | "Reserve"
  readonly targetBps: number; // 4000 | 2700 | 3300
  readonly actualBps: number | null;
  readonly driftBps: number | null;
  readonly isIdle: boolean;
  readonly adapter: string | null; // address, or null when idle (B3)
}

export interface VaultUserPosition {
  readonly whitelisted: boolean;
  readonly shares: string | null;
  readonly value: string | null; // USDC-denominated
  readonly deposits: string | null;
  readonly withdrawals: string | null;
}

// ── Mining / electricity / engine ────────────────────────────────────────────

export interface MiningMetrics {
  readonly reportedHashrateTh: string | null;
  readonly totalBtcEarnedSats: string | null;
  readonly lastReportTime: string | null;
}

export interface ElectricityStatus {
  readonly monthlyCost: string | null;
  readonly payee: string | null;
  readonly totalPaid: string | null;
  readonly lastPayment: string | null;
  readonly nextEligiblePayment: string | null;
  readonly canPay: boolean | null;
}

export interface MiningEngineStatus {
  readonly currentMonth: number | null;
  readonly productDurationMonths: number | null;
  readonly fleetActive: boolean | null;
  readonly curtailed: boolean | null;
  readonly halvingMonth: number | null;
  readonly vendingCurveBps: number | null;
}

// ── Events (v2 indexer target) ───────────────────────────────────────────────

export type VaultEventName =
  | "Deposit"
  | "Redeem"
  | "StrategyAdded"
  | "StrategyRemoved"
  | "Rebalance"
  | "VaultSwapped"
  | "ElectricityPaid"
  | "ElecPayeeUpdated"
  | "MonthlyElecCostUpdated"
  | "MiningMetricsReported"
  | "CurtailmentTriggered"
  | "CurtailmentLifted"
  | "TakeProfitExecuted"
  | "MonthlyEngineRun";

export interface VaultEvent {
  readonly name: VaultEventName;
  readonly category: "user" | "strategy" | "electricity" | "mining" | "engine";
  readonly severity: "info" | "notice" | "warning";
  readonly actor: string | null;
  readonly amount: string | null;
  readonly txHash: string | null;
  readonly blockNumber: number | null;
  readonly timestamp: string | null;
  readonly explorerUrl: string | null;
  readonly visibility: "investor" | "admin";
}

// ── Runtime / contract status ────────────────────────────────────────────────

export type ContractRuntimeMode = "v2-testnet" | "v2-mainnet" | "not_configured";

export interface ContractRuntimeStatus {
  readonly mode: ContractRuntimeMode;
  readonly chainId: number | null;
  readonly contractAddress: string | null;
  readonly codePresent: boolean;
  readonly indexerLagBlocks: number | null;
}

// ── Aggregated view DTOs (so the client makes one call per screen) ───────────

export interface DashboardDTO {
  readonly runtime: ContractRuntimeStatus;
  readonly vault: Resolved<VaultSnapshot>;
  readonly capacity: Resolved<VaultCapacity>;
  readonly position: Resolved<VaultUserPosition>;
  readonly strategies: Resolved<readonly VaultStrategy[]>;
  readonly mining: Resolved<MiningMetrics>;
  readonly engine: Resolved<MiningEngineStatus>;
  readonly recentEvents: Resolved<readonly VaultEvent[]>;
}
