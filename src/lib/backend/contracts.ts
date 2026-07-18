// src/lib/backend/contracts.ts
//
// Canonical domain TYPES for the hearst-connect-backend API contract.
// Deliberately a LOCAL COPY, not a cross-repo import: the backend now lives
// in its own repository (github.com/Hearst-Corporation/hearst-connect-backend)
// with its own history and its own deploy lifecycle — the frontend cannot
// import its source files, only call its HTTP API. This file is the
// frontend's own record of that contract (mirrors
// hearst-connect-backend/src/domain/index.ts and
// hearst-connect-backend/src/api/envelope.ts as of the version this frontend
// targets). If the backend's contract changes, this file is updated by hand
// (or regenerated from an OpenAPI/JSON-Schema export — see
// docs/backend-integration.md) — never by reaching into the other repo.

// ── Envelope (src/api/envelope.ts on the backend) ────────────────────────────

export type EnvelopeStatus = "LIVE" | "SNAPSHOT" | "STALE" | "SIMULATED" | "NOT_CONFIGURED" | "UNAVAILABLE";

export interface ResponseMeta {
  readonly status: EnvelopeStatus;
  readonly source: string;
  readonly generatedAt: string;
  readonly freshnessSeconds: number | null;
  readonly version: "v1";
  readonly reason: string | null;
}

export interface Envelope<T> {
  readonly data: T;
  readonly meta: ResponseMeta;
}

// ── Provenance / honesty primitives (src/domain/index.ts) ───────────────────

export type SourceProvenance = "live" | "db" | "indexed" | "manual" | "fixture";

export type DataStatus =
  | "LIVE"
  | "STALE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED";

export interface DataFreshness {
  readonly asOf: string | null;
  readonly ageSeconds: number | null;
  readonly stale: boolean;
}

export interface Resolved<T> {
  readonly status: DataStatus;
  readonly value: T | null;
  readonly provenance: SourceProvenance;
  readonly freshness: DataFreshness;
  readonly reason?: string;
}

// ── Vault ─────────────────────────────────────────────────────────────────

export type PocketId = "B1" | "B2" | "B3";

export interface VaultSnapshot {
  readonly asset: string;
  readonly assetDecimals: 6;
  readonly totalAssets: string | null;
  readonly totalShares: string | null;
  readonly navPerShare: string | null;
  readonly permissionDisabled: boolean | null;
  readonly miningNoteMode: boolean | null;
  readonly productDurationMonths: number | null;
}

export interface VaultStrategy {
  readonly pocket: PocketId;
  readonly label: string;
  readonly targetBps: number;
  readonly actualBps: number | null;
  readonly driftBps: number | null;
  readonly isIdle: boolean;
  readonly adapter: string | null;
}

// ── Dashboard blocks ──────────────────────────────────────────────────────

export interface InvestorIdentity {
  readonly kycStatus: string | null;
  readonly shareClass: "A" | "B" | null;
  readonly whitelisted: boolean | null;
  readonly walletAddress: string | null;
  readonly accredited: boolean;
}

export interface InvestorPosition {
  readonly principal: string | null;
  readonly accrued: string | null;
  readonly value: string | null;
  readonly deposits: string | null;
  readonly withdrawals: string | null;
  readonly shares: string | null;
  readonly positionsCount: number;
  readonly subscribedAt: string | null;
  readonly status: string | null;
}

export interface VaultCapacityBlock {
  readonly tvlCap: string | null;
  readonly totalAssets: string | null;
  readonly availableCapacity: string | null;
  readonly utilizationBps: number | null;
}

export interface SubscriptionSummary {
  readonly subscriptionOpen: boolean;
  readonly minimumDeposit: string | null;
  readonly whitelistRequired: boolean;
  readonly userEligible: boolean | null;
}

export interface AllocationPocket {
  readonly pocket: PocketId;
  readonly label: string;
  readonly targetBps: number;
  readonly actualBps: number | null;
}

export interface AllocationBreakdown {
  readonly pockets: readonly AllocationPocket[];
  readonly targetTotalBps: number;
}

export interface ReserveSummary {
  readonly reserveUsdc: string | null;
  readonly reserveBps: number | null;
  readonly electricityCoveredMonths: number | null;
}

export interface PerformanceSummary {
  readonly navPerShare: string | null;
  readonly totalReturnBps: number | null;
  readonly takeProfitProgressBps: number | null;
}

export interface DistributionItem {
  readonly period: string;
  readonly amountUsdc: string;
  readonly distributedAt: string;
  readonly status: string;
}

export interface DistributionSummary {
  readonly count: number;
  readonly totalDistributedUsdc: string | null;
  readonly lastDistributionAt: string | null;
  readonly recent: readonly DistributionItem[];
}

export interface RebalancingSummary {
  readonly lastRebalanceAt: string | null;
  readonly driftBps: number | null;
  readonly pending: boolean | null;
}

export interface ActivityItem {
  readonly type: string;
  readonly amountUsdc: string;
  readonly occurredAt: string;
  readonly txHash: string | null;
}

export type AlertSeverity = "info" | "notice" | "warning";

export interface AlertItem {
  readonly code: string;
  readonly severity: AlertSeverity;
  readonly message: string;
}

export interface ProofSummary {
  readonly totalProofs: number;
  readonly latestProofAt: string | null;
  readonly types: readonly string[];
}

export interface AiExpertsSummary {
  readonly activeExperts: number | null;
  readonly lastSignalAt: string | null;
}

// ── Mining ────────────────────────────────────────────────────────────────

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

// ── Events ────────────────────────────────────────────────────────────────

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

// ── Runtime / contract status ────────────────────────────────────────────

export type ContractRuntimeMode = "v2-testnet" | "v2-mainnet" | "not_configured";

export interface ContractRuntimeStatus {
  readonly mode: ContractRuntimeMode;
  readonly chainId: number | null;
  readonly contractAddress: string | null;
  readonly codePresent: boolean;
  readonly indexerLagBlocks: number | null;
}

export interface RuntimeSummary {
  readonly contract: ContractRuntimeStatus;
  readonly generatedAt: string;
}

// ── Dashboard DTO ─────────────────────────────────────────────────────────

export interface DashboardDTO {
  readonly runtime: ContractRuntimeStatus;
  readonly meta: RuntimeSummary;
  readonly identity: Resolved<InvestorIdentity>;
  readonly position: Resolved<InvestorPosition>;
  readonly distributions: Resolved<DistributionSummary>;
  readonly activity: Resolved<readonly ActivityItem[]>;
  readonly proofs: Resolved<ProofSummary>;
  readonly allocation: Resolved<AllocationBreakdown>;
  readonly subscription: Resolved<SubscriptionSummary>;
  readonly alerts: Resolved<readonly AlertItem[]>;
  readonly capacity: Resolved<VaultCapacityBlock>;
  readonly reserve: Resolved<ReserveSummary>;
  readonly mining: Resolved<MiningMetrics>;
  readonly performance: Resolved<PerformanceSummary>;
  readonly rebalancing: Resolved<RebalancingSummary>;
  readonly engine: Resolved<MiningEngineStatus>;
  readonly aiExperts: Resolved<AiExpertsSummary>;
  readonly vault: Resolved<VaultSnapshot>;
  readonly strategies: Resolved<readonly VaultStrategy[]>;
  readonly recentEvents: Resolved<readonly VaultEvent[]>;
}

// ── BTC DTO (mirrors hearst-connect-backend/src/application/btc.ts) ─────────

export interface BtcReserve {
  readonly balanceUsdc: string | null;
  readonly balanceBtc: string | null;
}

export interface BtcExposure {
  readonly pouch: "B2";
  readonly valueUsdc: string | null;
  readonly targetBps: number | null;
  readonly actualBps: number | null;
}

export interface BtcProduced {
  readonly totalSats: string | null;
  readonly lastReportTime: string | null;
}

export interface TakeProfitTier {
  readonly triggerBtcUsd: string | null;
  readonly sellBps: number | null;
  readonly executed: boolean | null;
}

export interface BtcAttribution {
  readonly attributedBtcSats: string | null;
  readonly attributedBtcUsd: string | null;
  readonly lastVerifiedAt: string | null;
}

export interface BtcProductionPoint {
  readonly period: string;
  readonly satsEarned: string;
  readonly cumulativeSatsEarned: string;
}

export interface BtcProduction {
  readonly monthly: readonly BtcProductionPoint[];
  readonly cumulativeSatsEarned: string | null;
  readonly cumulativeBtcEarned: string | null;
}

export type BtcCustodyProvider = "fireblocks" | "unknown";

export interface BtcCustody {
  readonly provider: BtcCustodyProvider | null;
  readonly vaultAccountId: string | null;
  readonly proofOfReserveAttestedAt: string | null;
  readonly withdrawalPolicy: string | null;
}

export type BtcProofKind = "por" | "mining-attestation" | "custody-attestation" | "event-log";

export interface BtcProofRef {
  readonly label: string;
  readonly href: string;
  readonly kind: BtcProofKind;
}

export interface BtcDTO {
  readonly runtime: ContractRuntimeStatus;
  readonly reserve: Resolved<BtcReserve>;
  readonly exposure: Resolved<BtcExposure>;
  readonly btcProduced: Resolved<BtcProduced>;
  readonly takeProfitTiers: Resolved<readonly TakeProfitTier[]>;
  readonly events: Resolved<readonly VaultEvent[]>;
  readonly attribution: Resolved<BtcAttribution>;
  readonly production: Resolved<BtcProduction>;
  readonly custody: Resolved<BtcCustody>;
  readonly proofs: Resolved<readonly BtcProofRef[]>;
}

// ── Mining view DTO (mirrors hearst-connect-backend/src/application/mining.ts) ─

/** Real DB-backed fleet/market telemetry (MiningMetric table) — LIVE when a
 *  row exists, NOT_CONFIGURED when the table is empty. Distinct from the
 *  contract-owned on-chain facts below (hashrate/btcEarned/etc). */
export interface MiningTelemetryRow {
  readonly takenAt: string;
  readonly deployedHashrateTh: string;
  readonly uptimePct: string;
  readonly hashprice: string;
  readonly difficulty: string;
  readonly btcPrice: string;
  readonly energyCost: string;
  readonly miningMarginScore: number;
  readonly hashpriceTrendPct: string;
  readonly operationalConfidence: number;
  readonly alertLevel: string | null;
  readonly summary: string | null;
  readonly recommendation: string | null;
}

export interface MiningDTO {
  readonly runtime: ContractRuntimeStatus;
  // On-chain / attested surfaces — contract-owned, NOT_CONFIGURED until v2.
  readonly hashrate: Resolved<MiningMetrics>;
  readonly btcEarned: Resolved<MiningMetrics>;
  readonly electricity: Resolved<ElectricityStatus>;
  readonly curtailment: Resolved<MiningEngineStatus>;
  readonly engine: Resolved<MiningEngineStatus>;
  // Real DB telemetry.
  readonly operationalTelemetry: Resolved<MiningTelemetryRow>;
}

