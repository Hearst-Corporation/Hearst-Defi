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

// ── Dashboard blocks (v2.1 — rich investor cockpit view model) ───────────────
//
// The dashboard screen shows far more than a bare position. Each block below is
// wrapped in Resolved<T> at the DTO so the frontend renders provenance/status
// honestly. Facts split three ways:
//   • DB-backed (Investor/Position/Distribution/InvestorTransaction) → LIVE/PARTIAL
//   • product constants (allocation targets, term, APY range, min ticket) → manual · LIVE
//   • contract-owned (capacity, on-chain reserve/mining/rebalancing, actual bps) → NOT_CONFIGURED
// No block ever fabricates a number: an unknown field is null with a non-LIVE status.

/** Access / identity facts from the canonical DB (Investor row). */
export interface InvestorIdentity {
  readonly kycStatus: string | null; // pending | approved | rejected
  readonly shareClass: "A" | "B" | null; // DB does not hold this yet → null (honest)
  readonly whitelisted: boolean | null; // on-chain fact — null until v2 read
  readonly walletAddress: string | null; // set once a wallet is connected for payment
  readonly accredited: boolean; // accreditationAttestedAt !== null
}

/** The investor's on-book position, aggregated from the DB. Enriches
 *  VaultUserPosition with the accumulation figures the cockpit reads. */
export interface InvestorPosition {
  readonly principal: string | null; // sum(principalUsdc), decimal string
  readonly accrued: string | null; // sum(accruedYieldUsdc) — BTC accumulated (est.)
  readonly value: string | null; // principal + accrued
  readonly deposits: string | null; // = principal (on-book deposits)
  readonly withdrawals: string | null; // sum(distributedUsdc)
  readonly shares: string | null; // on-chain → null (DB holds no shares)
  readonly positionsCount: number; // number of held positions (0 = no position)
  readonly subscribedAt: string | null; // earliest subscribedAt (ISO), lock-up anchor
  readonly status: string | null; // active | matured | exited (primary position)
}

/** Vault capacity — tvlCap / totalAssets / availableCapacity. All contract-owned:
 *  NOT_CONFIGURED until v2 is deployed. availableCapacity, when known, is computed
 *  in the SERVICE (max(cap - assets, 0)) — never fabricated on the client. */
export interface VaultCapacityBlock {
  readonly tvlCap: string | null; // USDC 6dp decimal string
  readonly totalAssets: string | null;
  readonly availableCapacity: string | null; // max(cap - assets, 0), computed HERE
  readonly utilizationBps: number | null;
}

/** Subscription eligibility — a mix of DB-derivable facts (open, min deposit,
 *  whitelist-required, user-eligible) and contract-gated ones. minimumDeposit is a
 *  product constant (manual · LIVE); userEligible is DB-derived (KYC approved). */
export interface SubscriptionSummary {
  readonly subscriptionOpen: boolean; // product state (manual · LIVE)
  readonly minimumDeposit: string | null; // product constant, USDC decimal string
  readonly whitelistRequired: boolean; // product/regulatory rule (manual · LIVE)
  readonly userEligible: boolean | null; // DB-derived: KYC approved (null if no investor)
}

/** A single pocket's allocation. targetBps is a product constant (manual · LIVE);
 *  actualBps is on-chain (NOT_CONFIGURED until v2). */
export interface AllocationPocket {
  readonly pocket: PocketId; // B1 | B2 | B3
  readonly label: string;
  readonly targetBps: number; // 4000 | 2700 | 3300 — product constant
  readonly actualBps: number | null; // on-chain → null until v2
}

/** Target allocation of the 3 pockets — product constants. */
export interface AllocationBreakdown {
  readonly pockets: readonly AllocationPocket[];
  readonly targetTotalBps: number; // 10000
}

/** Contract-owned reserve status (B3 USDC reserve). NOT_CONFIGURED until v2. */
export interface ReserveSummary {
  readonly reserveUsdc: string | null;
  readonly reserveBps: number | null;
  readonly electricityCoveredMonths: number | null;
}

/** Contract-owned performance figures. NOT_CONFIGURED until v2. */
export interface PerformanceSummary {
  readonly navPerShare: string | null;
  readonly totalReturnBps: number | null;
  readonly takeProfitProgressBps: number | null;
}

/** Distribution history for the investor, from the Distribution table. v2 is an
 *  ACCUMULATION note — there is NO periodic cash distribution, so this is expected
 *  to be empty/PARTIAL. We report honestly whatever the DB holds. */
export interface DistributionSummary {
  readonly count: number; // number of distribution rows seen for this investor
  readonly totalDistributedUsdc: string | null; // sum(amountUsdc) or null when none
  readonly lastDistributionAt: string | null; // ISO of the most recent, or null
  readonly recent: readonly DistributionItem[]; // most-recent-first (bounded)
}

export interface DistributionItem {
  readonly period: string; // "2026-04"
  readonly amountUsdc: string; // decimal string
  readonly distributedAt: string; // ISO
  readonly status: string; // pending | executed | …
}

/** Contract-owned rebalancing signal. NOT_CONFIGURED until v2. */
export interface RebalancingSummary {
  readonly lastRebalanceAt: string | null;
  readonly driftBps: number | null;
  readonly pending: boolean | null;
}

/** A single ledger movement for the investor, from InvestorTransaction. */
export interface ActivityItem {
  readonly type: string; // deposit | claim | withdraw | distribution
  readonly amountUsdc: string; // decimal string
  readonly occurredAt: string; // ISO
  readonly txHash: string | null;
}

export type AlertSeverity = "info" | "notice" | "warning";

/** A derived, honest advisory alert (never a promise, never a forbidden word). */
export interface AlertItem {
  readonly code: string; // machine code, e.g. "kyc_pending" | "no_position"
  readonly severity: AlertSeverity;
  readonly message: string;
}

/** Proof center summary — what is DB-backed (Proof table counts). */
export interface ProofSummary {
  readonly totalProofs: number;
  readonly latestProofAt: string | null; // ISO of the most recent proof, or null
  readonly types: readonly string[]; // distinct proofType values seen
}

/** AI experts advisory block. Contract/agent-owned attested feed is not wired →
 *  NOT_CONFIGURED. Kept as a first-class block so the client renders its slot. */
export interface AiExpertsSummary {
  readonly activeExperts: number | null;
  readonly lastSignalAt: string | null;
}

/** Non-Resolved runtime summary carried at the DTO level. */
export interface RuntimeSummary {
  readonly contract: ContractRuntimeStatus;
  readonly generatedAt: string; // ISO — when this DTO was assembled
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
  readonly meta: RuntimeSummary; // generatedAt + contract, for the client footer

  // ── DB-backed (LIVE / PARTIAL) ─────────────────────────────────────────────
  readonly identity: Resolved<InvestorIdentity>;
  readonly position: Resolved<InvestorPosition>;
  readonly distributions: Resolved<DistributionSummary>;
  readonly activity: Resolved<readonly ActivityItem[]>;
  readonly proofs: Resolved<ProofSummary>;

  // ── Product constants (manual · LIVE) ──────────────────────────────────────
  readonly allocation: Resolved<AllocationBreakdown>;
  readonly subscription: Resolved<SubscriptionSummary>;

  // ── Derived (honest, never fabricated numbers) ─────────────────────────────
  readonly alerts: Resolved<readonly AlertItem[]>;

  // ── Contract-owned (NOT_CONFIGURED until v2 deployed + indexed) ─────────────
  readonly capacity: Resolved<VaultCapacityBlock>;
  readonly reserve: Resolved<ReserveSummary>;
  readonly mining: Resolved<MiningMetrics>;
  readonly performance: Resolved<PerformanceSummary>;
  readonly rebalancing: Resolved<RebalancingSummary>;
  readonly engine: Resolved<MiningEngineStatus>;
  readonly aiExperts: Resolved<AiExpertsSummary>;

  // ── Retained surfaces (kept so existing consumers keep compiling) ──────────
  readonly vault: Resolved<VaultSnapshot>;
  readonly strategies: Resolved<readonly VaultStrategy[]>;
  readonly recentEvents: Resolved<readonly VaultEvent[]>;
}
